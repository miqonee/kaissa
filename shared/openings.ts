// shared/openings.ts
// База дебютов с кодами ECO, названиями, вариантами и планами сторон

export interface OpeningEntry {
  eco: string;
  nameRu: string;
  nameEn: string;
  variationRu?: string;
  moves: string[]; // последовательность ходов SAN
  planRu: string;  // Стратегический план сторон
}

export interface RecognizedOpening {
  eco: string;
  nameRu: string;
  nameEn: string;
  variationRu?: string;
  movesSan: string;
  planRu: string;
  stage: 'start' | 'theory' | 'middlegame';
  plyCount: number;
}

export const OPENINGS_DATABASE: OpeningEntry[] = [
  // ---------- 1. e4 e5 (Открытые дебюты) ----------
  {
    eco: 'C50',
    nameRu: 'Итальянская партия',
    nameEn: 'Italian Game',
    variationRu: 'Вариант Джоко Пиано',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
    planRu: 'Белые готовят захват центра ходами c3 и d4, оказывая фигурное давление на пункт f7. Чёрные укрепляют центр d6 и готовят контригру на королевском фланге.',
  },
  {
    eco: 'C55',
    nameRu: 'Итальянская партия',
    nameEn: 'Italian Game',
    variationRu: 'Защита двух коней',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
    planRu: 'Острая тактическая борьба. Белые стремятся к немедленной атаке на f7 ходом Ng5 или захвату центра d4. Чёрные готовы пожертвовать пешку ради опережения в развитии.',
  },
  {
    eco: 'C51',
    nameRu: 'Гамбит Эванса',
    nameEn: 'Evans Gambit',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'],
    planRu: 'Белые жертвуют пешку b4 ради выигрыша темпа, захвата центра ходами c3-d4 и вскрытия диагоналей для быстрой атаки на короля.',
  },
  {
    eco: 'C65',
    nameRu: 'Испанская партия',
    nameEn: 'Ruy Lopez',
    variationRu: 'Берлинская защита',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'],
    planRu: '«Берлинская стена». Чёрные блокируют центр и стремятся к переходу в прочный эндшпиль без ферзей, где их два слона компенсируют сдвоенные пешки.',
  },
  {
    eco: 'C60',
    nameRu: 'Испанская партия',
    nameEn: 'Ruy Lopez',
    variationRu: 'Классическая система',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    planRu: 'Белые создают косвенное давление на пешку e5 через связку коня c6, готовя плавный захват пространства в центре и на ферзевом фланге.',
  },
  {
    eco: 'C78',
    nameRu: 'Испанская партия',
    nameEn: 'Ruy Lopez',
    variationRu: 'Система Морфи',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O'],
    planRu: 'Глубокая стратегическая маневренная борьба. Белые выстраивают пешечную цепь c3-d4, а чёрные стремятся стабилизировать ферзевый фланг ходом b5.',
  },
  {
    eco: 'C45',
    nameRu: 'Шотландская партия',
    nameEn: 'Scotch Game',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'],
    planRu: 'Белые немедленно вскрывают центральные вертикали. Чёрные стремятся развить слона на c5 или коня на f6 для быстрой фигурной контригры.',
  },
  {
    eco: 'C42',
    nameRu: 'Русская партия',
    nameEn: 'Petrov Defence',
    moves: ['e4', 'e5', 'Nf3', 'Nf6'],
    planRu: 'Симметричный встречный удар по центру. Чёрные уклоняются от пассивной защиты пешки e5 и сразу атакуют белую пешку e4.',
  },
  {
    eco: 'C30',
    nameRu: 'Королевский гамбит',
    nameEn: "King's Gambit",
    moves: ['e4', 'e5', 'f4'],
    planRu: 'Романтическая атака. Белые отвлекают пешку e5 для создания мощного пешечного центра и вскрытия вертикали «f» для ладьи.',
  },
  {
    eco: 'C25',
    nameRu: 'Венская партия',
    nameEn: 'Vienna Game',
    moves: ['e4', 'e5', 'Nc3'],
    planRu: 'Белые развивают фигуру и сохраняют гибкость: подготовка f4, Bc4 или раннего d4 в зависимости от ответа соперника.',
  },
  {
    eco: 'C47',
    nameRu: 'Дебют четырех коней',
    nameEn: 'Four Knights Game',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'],
    planRu: 'Плотное гармоничное развитие всех легких фигур. Обе стороны борются за контроль центральных полей d4 и d5.',
  },
  {
    eco: 'C41',
    nameRu: 'Защита Филидора',
    nameEn: 'Philidor Defence',
    moves: ['e4', 'e5', 'Nf3', 'd6'],
    planRu: 'Прочное, но слегка стесненное построение чёрных. Белые захватывают пространство ходом d4, чёрные маневрируют фигурами на первых рядах.',
  },

  // ---------- 1. e4 c5 (Сицилианская защита) ----------
  {
    eco: 'B90',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Вариант Найдорфа',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    planRu: 'Острейшая асимметричная битва. Ход a6 берёт под контроль поле b5 и готовит фигурную экспансию на ферзевом фланге (b5, Bb7, Nbd7).',
  },
  {
    eco: 'B70',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Вариант Дракона',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'],
    planRu: 'Фианкетто слона на g7 образует огневую диагональ «дракона». Часто возникают разносторонние рокировки со взаимными штурмами королей.',
  },
  {
    eco: 'B80',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Схевенингенский вариант',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e6'],
    planRu: 'Маленький центр e6-d6 обеспечивает чёрным гибкую оборону и готовность к центральному прорыву d5.',
  },
  {
    eco: 'B33',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Челябинский вариант (Свешникова)',
    moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5'],
    planRu: 'Чёрные добровольно ослабляют пункт d5 ради активной фигурной игры, темпового захвата пространства и давления на королевском фланге.',
  },
  {
    eco: 'B40',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Вариант Паульсена',
    moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'a6'],
    planRu: 'Гибкая дебютная система. Чёрные избегают раннего размена фигур и развивают ферзевый фланг с опорой на полуоткрытую вертикаль «c».',
  },
  {
    eco: 'B22',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Вариант Алапина',
    moves: ['e4', 'c5', 'c3'],
    planRu: 'Белые готовят мощный пешечный дуэт в центре путем d4. Чёрные отвечают ударом по центру d5 или развитием коня Nf6.',
  },
  {
    eco: 'B23',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Закрытый вариант',
    moves: ['e4', 'c5', 'Nc3', 'Nc6', 'g3'],
    planRu: 'Белые отказываются от раннего d4 в пользу позиционного давления, фианкеттируя слона на g2 и накапливая силы для штурма на королевском фланге.',
  },
  {
    eco: 'B20',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    moves: ['e4', 'c5'],
    planRu: 'Борьба за центр с фланга. Чёрные разменивают боковую пешку «c» на центральную белую «d», получая полуоткрытую вертикаль «c» и пешечный перевес в центре.',
  },

  // ---------- 1. e4 e6 (Французская защита) ----------
  {
    eco: 'C15',
    nameRu: 'Французская защита',
    nameEn: 'French Defence',
    variationRu: 'Вариант Винавера',
    moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4'],
    planRu: 'Связка коня c3 ведёт к сдвоению белых пешек и контрударам чёрных по пешечному центру c5 и f6.',
  },
  {
    eco: 'C02',
    nameRu: 'Французская защита',
    nameEn: 'French Defence',
    variationRu: 'Продвинутая система',
    moves: ['e4', 'e6', 'd4', 'd5', 'e5'],
    planRu: 'Белые фиксируют перевес в пространстве пешечным клином e5. Чёрные систематически подрывают базу пешечной цепи ходами c5, Nc6, Qb6.',
  },
  {
    eco: 'C05',
    nameRu: 'Французская защита',
    nameEn: 'French Defence',
    variationRu: 'Вариант Тарраша',
    moves: ['e4', 'e6', 'd4', 'd5', 'Nd2'],
    planRu: 'Белые избегают связки слоном Bb4, сохраняя пешечный центр цельным и поддерживая гибкость расстановки фигур.',
  },
  {
    eco: 'C00',
    nameRu: 'Французская защита',
    nameEn: 'French Defence',
    moves: ['e4', 'e6', 'd4', 'd5'],
    planRu: 'Плотное пешечное противостояние. Чёрные наносят удар по центру d5, белые выбирают между закрытием центра e5 или разменом.',
  },

  // ---------- 1. e4 c6 (Защита Каро-Канн) ----------
  {
    eco: 'B18',
    nameRu: 'Защита Каро-Канн',
    nameEn: 'Caro-Kann Defence',
    variationRu: 'Классический вариант',
    moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'],
    planRu: 'Чёрные без препятствий развивают белопольного слона на f5 до закрытия пешечной структуры, получая безопасного короля и монолитный эндшпиль.',
  },
  {
    eco: 'B12',
    nameRu: 'Защита Каро-Канн',
    nameEn: 'Caro-Kann Defence',
    variationRu: 'Продвинутый вариант',
    moves: ['e4', 'c6', 'd4', 'd5', 'e5'],
    planRu: 'Белые запирают центр, а чёрные развивают слона на f5 и начинают планомерный подрыв структуры белых ходами c5 и f6.',
  },
  {
    eco: 'B10',
    nameRu: 'Защита Каро-Канн',
    nameEn: 'Caro-Kann Defence',
    moves: ['e4', 'c6'],
    planRu: 'Сверхнадёжный полуоткрытый дебют. Подготовка опорного продвижения d5 без запирания белопольного слона c8.',
  },

  // ---------- Прочие ответы на 1. e4 ----------
  {
    eco: 'B01',
    nameRu: 'Скандинавская защита',
    nameEn: 'Scandinavian Defence',
    moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5'],
    planRu: 'Немедленный встречный удар в центре. Чёрный ферзь отступает на a5 или d6, обеспечивая свободное фигурное развитие.',
  },
  {
    eco: 'B02',
    nameRu: 'Защита Алехина',
    nameEn: 'Alekhine Defence',
    moves: ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6'],
    planRu: 'Гипермодернистская стратегия: выманивание белых пешек вперёд с последующим окружением и подрывом передовой пешечной фаланги.',
  },
  {
    eco: 'B07',
    nameRu: 'Защита Пирца-Уфимцева',
    nameEn: 'Pirc Defence',
    moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'],
    planRu: 'Чёрные уступают центр на первых ходах, фианкеттируют слона на g7 и затем контратакуют центр ходами c5 или e5.',
  },

  // ---------- 1. d4 (Закрытые и полузакрытые дебюты) ----------
  {
    eco: 'D37',
    nameRu: 'Отказанный ферзевый гамбит',
    nameEn: "Queen's Gambit Declined",
    variationRu: 'Классическая система',
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'Be7'],
    planRu: 'Фундаментальный оплот классических шахмат. Чёрные держат пункт d5, белые оказывают длительное позиционное давление на центр и вертикаль «c».',
  },
  {
    eco: 'D20',
    nameRu: 'Принятый ферзевый гамбит',
    nameEn: "Queen's Gambit Accepted",
    moves: ['d4', 'd5', 'c4', 'dxc4'],
    planRu: 'Чёрные сбивают пешку c4, освобождая центральные поля и концентрируясь на развитии c5 и контрударе по белым пешкам.',
  },
  {
    eco: 'D10',
    nameRu: 'Славянская защита',
    nameEn: 'Slav Defence',
    moves: ['d4', 'd5', 'c4', 'c6'],
    planRu: 'Чёрные укрепляют центр d5 пешкой c6, не перекрывая диагональ слону c8. Один из самых стойких и популярных дебютов гроссмейстеров.',
  },
  {
    eco: 'D00',
    nameRu: 'Ферзевый гамбит',
    nameEn: "Queen's Gambit",
    moves: ['d4', 'd5', 'c4'],
    planRu: 'Белые предлагают размен боковой пешки c4 ради захвата центрального превосходства и раннего открытия вертикали «c».',
  },
  {
    eco: 'D02',
    nameRu: 'Лондонская система',
    nameEn: 'London System',
    moves: ['d4', 'd5', 'Bf4'],
    planRu: 'Универсальная прочная пирамидальная система (Bf4, e3, c3, Nf3). Белые развивают слона вне пешечной цепи и контролируют ключевой пункт e5.',
  },
  {
    eco: 'E00',
    nameRu: 'Каталонское начало',
    nameEn: 'Catalan Opening',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2'],
    planRu: 'Синтез ферзевого гамбита и королевского фианкетто. Дальнобойный слон g2 доминирует на большой диагонали и давит на ферзевый фланг чёрных.',
  },
  {
    eco: 'E60',
    nameRu: 'Староиндийская защита',
    nameEn: "King's Indian Defence",
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'],
    planRu: 'Любимое оружие Таля, Каспарова и Фишера. Чёрные допускают создание белого центра, чтобы затем взломать его ходом e5 и развить сокрушительную атаку на короля.',
  },
  {
    eco: 'E20',
    nameRu: 'Защита Нимцовича',
    nameEn: 'Nimzo-Indian Defence',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
    planRu: 'Связка коня c3 блокирует продвижение e4. Чёрные готовы разменять слона на коня ради сдвоения белых пешек и блокады пунктов c4 и c5.',
  },
  {
    eco: 'E12',
    nameRu: 'Новоиндийская защита',
    nameEn: "Queen's Indian Defence",
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'],
    planRu: 'Фианкетто слона на b7 борется за контроль над ключевым центральным полем e4 при надежной и солидной позиции короля.',
  },
  {
    eco: 'D80',
    nameRu: 'Защита Грюнфельда',
    nameEn: 'Grunfeld Defence',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'],
    planRu: 'Чёрные отдают центр белым (cxd5 Nxd5, e4), чтобы подвергнуть его непрерывному фигурному обстрелу ходами Bg7, c5 и Qa5.',
  },
  {
    eco: 'A57',
    nameRu: 'Волжский гамбит (Бенко)',
    nameEn: 'Benko Gambit',
    moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5'],
    planRu: 'Чёрные жертвуют пешку b5 ради длительного непрекращающегося позиционного давления по полуоткрытым вертикалям «a» и «b».',
  },
  {
    eco: 'A80',
    nameRu: 'Голландская защита',
    nameEn: 'Dutch Defence',
    moves: ['d4', 'f5'],
    planRu: 'Бескомпромиссная борьба за поле e4 с первого хода. Чёрные берут под контроль пункт e4 и создают предпосылки для атаки на королевском фланге.',
  },

  // ---------- Фланговые начала ----------
  {
    eco: 'A10',
    nameRu: 'Английское начало',
    nameEn: 'English Opening',
    moves: ['c4'],
    planRu: 'Фланговый контроль центрального поля d5. Белые сохраняют гибкость выбора пешечной структуры и часто переходят в реверсивную сицилианскую защиту.',
  },
  {
    eco: 'A04',
    nameRu: 'Дебют Рети',
    nameEn: 'Reti Opening',
    moves: ['Nf3', 'd5', 'c4'],
    planRu: 'Гипермодернистская стратегия фигурного фигурного давления на центр соперника без раннего выдвижения пешек d2 и e2.',
  },
];

/**
 * Распознавание дебюта по сыгранной цепочке ходов (SAN)
 */
export function detectOpening(movesSan: string[]): RecognizedOpening {
  if (!movesSan || movesSan.length === 0) {
    return {
      eco: 'A00',
      nameRu: 'Начальная позиция',
      nameEn: 'Starting Position',
      movesSan: '—',
      planRu: 'Борьба за захват центра, гармоничное развитие лёгких фигур и обеспечение безопасности короля (рокировка).',
      stage: 'start',
      plyCount: 0,
    };
  }

  let bestMatch: OpeningEntry | null = null;
  let maxMatchedMoves = 0;

  for (const entry of OPENINGS_DATABASE) {
    const len = entry.moves.length;
    if (movesSan.length >= len) {
      let match = true;
      for (let i = 0; i < len; i++) {
        if (movesSan[i] !== entry.moves[i]) {
          match = false;
          break;
        }
      }
      if (match && len > maxMatchedMoves) {
        maxMatchedMoves = len;
        bestMatch = entry;
      }
    } else {
      // Частичное совпадение (партия только началась, ходов меньше, чем в ветке)
      let match = true;
      for (let i = 0; i < movesSan.length; i++) {
        if (movesSan[i] !== entry.moves[i]) {
          match = false;
          break;
        }
      }
      if (match && movesSan.length > maxMatchedMoves) {
        maxMatchedMoves = movesSan.length;
        bestMatch = entry;
      }
    }
  }

  if (!bestMatch) {
    // Нестандартное начало
    return {
      eco: 'A00',
      nameRu: 'Нестандартный дебют',
      nameEn: 'Uncommon Opening',
      movesSan: movesSan.slice(0, 6).join(' '),
      planRu: 'Оригинальная расстановка фигур вне основных классических дебютных канонов.',
      stage: movesSan.length > 8 ? 'middlegame' : 'theory',
      plyCount: movesSan.length,
    };
  }

  // Форматируем сыгранную строку ходов
  const movesFormatted: string[] = [];
  for (let i = 0; i < bestMatch.moves.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const w = bestMatch.moves[i];
    const b = bestMatch.moves[i + 1] ? ` ${bestMatch.moves[i + 1]}` : '';
    movesFormatted.push(`${moveNum}. ${w}${b}`);
  }

  const isMiddlegame = movesSan.length > bestMatch.moves.length + 3;

  return {
    eco: bestMatch.eco,
    nameRu: bestMatch.nameRu,
    nameEn: bestMatch.nameEn,
    variationRu: bestMatch.variationRu,
    movesSan: movesFormatted.join('  '),
    planRu: bestMatch.planRu,
    stage: isMiddlegame ? 'middlegame' : 'theory',
    plyCount: movesSan.length,
  };
}
