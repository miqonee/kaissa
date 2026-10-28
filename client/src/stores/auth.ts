import { defineStore } from "pinia";
import type { PublicUser } from "shared";
import { api, ApiError } from "../api/rest";
import { resetSocket } from "../api/socket";
import { trackGoal } from "../utils/analytics";
let guestJob: Promise<void> | null = null;
const sessionChecks = new WeakMap<object, Promise<boolean>>();
export const useAuthStore = defineStore("auth", {
  state: () => ({ user: null as PublicUser | null, checked: false, checking: false, revision: 0 }),
  actions: {
    check(): Promise<boolean> {
      const pending = sessionChecks.get(this);
      if (pending) return pending;
      this.checking = true;
      const job = this.checkSession().finally(() => {
        if (sessionChecks.get(this) === job) {
          sessionChecks.delete(this);
          this.checking = false;
        }
      });
      sessionChecks.set(this, job);
      return job;
    },
    async checkSession(): Promise<boolean> {
      const revision = ++this.revision;
      try {
        const { user } = await api.get<{ user: PublicUser }>("/api/auth/me");
        if (revision === this.revision) { this.user = user; this.checked = true; }
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          if (revision === this.revision) { this.user = null; this.checked = true; }
          return true;
        }
        // Retain the last known identity on a temporary network/server failure.
        return false;
      }
    },
    async ensureGuest() {
      if (this.user) return;
      if (!guestJob) {
        const create = async () => {
          // A second tab may have created the cookie while this tab waited for the lock.
          if (!await this.check()) throw new ApiError("Не удалось проверить сессию. Попробуйте ещё раз");
          if (this.user) {
            resetSocket();
            return;
          }
          const res = await api.post<{ user: PublicUser }>(
            "/api/auth/guest",
            {},
          );
          resetSocket();
          ++this.revision;
          this.user = res.user;
          this.checked = true;
          trackGoal("guest_started");
        };
        guestJob = (async () => {
          if ("locks" in navigator)
            await navigator.locks.request("kaissa-guest-session", create);
          else await create();
        })().finally(() => {
          guestJob = null;
        });
      }
      await guestJob;
    },
    async login(username: string, password: string) {
      const res = await api.post<{ user: PublicUser }>("/api/auth/login", {
        username,
        password,
      });
      resetSocket();
      sessionChecks.delete(this);
      this.checking = false;
      ++this.revision;
      this.user = res.user;
      this.checked = true;
    },
    async register(username: string, password: string) {
      if (!this.checked && !await this.check()) throw new ApiError("Не удалось проверить сессию. Попробуйте ещё раз");
      const url = this.user?.isGuest ? "/api/auth/claim" : "/api/auth/register";
      const res = await api.post<{ user: PublicUser }>(url, {
        username,
        password,
      });
      resetSocket();
      sessionChecks.delete(this);
      this.checking = false;
      ++this.revision;
      this.user = res.user;
      this.checked = true;
      trackGoal("registration_completed");
    },
    async logout() {
      await api.post("/api/auth/logout", {});
      resetSocket();
      ++this.revision;
      this.user = null;
      location.href = "/login";
    },
  },
});
