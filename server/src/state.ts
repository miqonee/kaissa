// Центральные синглтоны приложения (создаются один раз)
import { GamesManager } from './game/manager.js';
import { LobbiesManager } from './lobby/lobbies.js';

export const gamesManager = new GamesManager();
export const lobbies = new LobbiesManager();
