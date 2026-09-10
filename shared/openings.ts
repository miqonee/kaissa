// shared/openings.ts
// Расширенная база дебютов с кодами ECO, названиями, глубокими вариантами, планами и ветками продолжений

export interface OpeningEntry {
  eco: string;
  nameRu: string;
  nameEn: string;
  variationRu?: string;
  moves: string[]; // последовательность ходов SAN
  planRu: string;  // Стратегический план сторон
}

export interface OpeningContinuation {
  moveSan: string;
  eco: string;
  nameRu: string;
  variationRu?: string;
}

export interface RecognizedOpening {
  eco: string;
  nameRu: string;
  nameEn: string;
  variationRu?: string;
  movesSan: string;        // Нотация сыгранных ходов (или книги при старте)
  playedMovesSan: string;  // Полная нотация партии
  bookMovesSan: string;    // Канонические ходы книжного варианта
  planRu: string;          // Стратегический план
  stage: 'start' | 'theory' | 'middlegame';
  stageLabelRu: string;
  continuations: OpeningContinuation[]; // Теоретические ветки из текущей позиции
  plyCount: number;
}

export const OPENINGS_DATABASE: OpeningEntry[] = [
  // =================================================================
  // 1. e4 e5 (Открытые дебюты)
  // =================================================================
  {
    eco: 'C50',
    nameRu: 'Итальянская партия',
    nameEn: 'Italian Game',
    variationRu: 'Вариант Джоко Пиано',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
    planRu: 'Белые готовят захват центра ходами c3 и d4, оказывая фигурное давление на пункт f7. Чёрные укрепляют центр d6 и готовят контригру на королевском фланге.',
  },
  {
    eco: 'C53',
    nameRu: 'Итальянская партия',
    nameEn: 'Italian Game',
    variationRu: 'Тишайшая игра (Giuoco Pianissimo)',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3'],
    planRu: 'Плавная позиционная маневренная борьба. Белые надёжно защищают пешку e4 и готовят медленный перевод коня Nbd2-f1-g3.',
  },
  {
    eco: 'C55',
    nameRu: 'Итальянская партия',
    nameEn: 'Italian Game',
    variationRu: 'Защита двух коней',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
    planRu: 'Острая тактическая борьба. Белые стремятся к немедленной атаке на f7 ходом Ng5 или захвату центра d4. Чёрные готовы пожертвовать пешку ради инициативы.',
  },
  {
    eco: 'C57',
    nameRu: 'Итальянская партия',
    nameEn: 'Italian Game',
    variationRu: 'Атака жареной печени (Fried Liver Attack)',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7'],
    planRu: 'Легендарная романтическая жертва фигуры на f7, выманивающая чёрного короля в центр доски под перекрёстный огонь ферзя и коней.',
  },
  {
    eco: 'C58',
    nameRu: 'Итальянская партия',
    nameEn: 'Italian Game',
    variationRu: 'Защита двух коней: Вариант Полерио',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5'],
    planRu: 'Чёрные отдают пешку, но оттесняют слона c4 и захватывают ключевые диагонали для фигурной контригры.',
  },
  {
    eco: 'C51',
    nameRu: 'Гамбит Эванса',
    nameEn: 'Evans Gambit',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'],
    planRu: 'Белые жертвуют пешку b4 ради выигрыша темпа, захвата центра ходами c3-d4 и вскрытия диагоналей для быстрой атаки на короля.',
  },
  {
    eco: 'C52',
    nameRu: 'Гамбит Эванса',
    nameEn: 'Evans Gambit',
    variationRu: 'Принятый гамбит Эванса',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5'],
    planRu: 'Слон отступает на a5, сохраняя диагональ a5-e1. Белые продолжают d4 и O-O, наращивая колоссальное давление в центре.',
  },
  {
    eco: 'C50',
    nameRu: 'Венгерская партия',
    nameEn: 'Hungarian Defence',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Be7'],
    planRu: 'Чёрные избегают ранней тактической бури, развивая слона на e7. Прочная оборона с плавным переходом к d6 и Nf6.',
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
    eco: 'C67',
    nameRu: 'Испанская партия',
    nameEn: 'Ruy Lopez',
    variationRu: 'Берлинский эндшпиль',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4', 'd4', 'Nd6', 'Bxc6', 'dxc6', 'dxe5', 'Nf5', 'Qxd8+', 'Kxd8'],
    planRu: 'Знаменитый «Берлинский эндшпиль» Крамника-Каспарова. Чёрный король лишён рокировки, но позиция почти неприступна.',
  },
  {
    eco: 'C70',
    nameRu: 'Испанская партия',
    nameEn: 'Ruy Lopez',
    variationRu: 'Защита Морфи',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4'],
    planRu: 'Чёрные выясняют намерения белого слона ходом a6. Белые сохраняют фигуру для давления на центр.',
  },
  {
    eco: 'C78',
    nameRu: 'Испанская партия',
    nameEn: 'Ruy Lopez',
    variationRu: 'Система Морфи (Открытый центр)',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O'],
    planRu: 'Глубокая стратегическая борьба. Белые готовы к защите центра пешкой c3 и ладьей Re1, чёрные готовят ход b5.',
  },
  {
    eco: 'C88',
    nameRu: 'Испанская партия',
    nameEn: 'Ruy Lopez',
    variationRu: 'Закрытый вариант',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O'],
    planRu: 'Классическая вершина шахматной стратегии. Белые маневрируют конем Nbd2-f1-g3, чёрные атакуют слона b3 ходом Na5.',
  },
  {
    eco: 'C89',
    nameRu: 'Испанская партия',
    nameEn: 'Ruy Lopez',
    variationRu: 'Контратака Маршалла',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'O-O', 'c3', 'd5'],
    planRu: 'Жертва центральной пешки d5 ради мощнейшей непрерывной атаки на белого короля фигурами Bd6, Qh4, Ng4.',
  },
  {
    eco: 'C60',
    nameRu: 'Испанская партия',
    nameEn: 'Ruy Lopez',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    planRu: 'Белые создают косвенное давление на пешку e5 через связку коня c6, готовя плавный захват пространства в центре.',
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
    nameRu: 'Русская партия (Защита Петрова)',
    nameEn: 'Petrov Defence',
    moves: ['e4', 'e5', 'Nf3', 'Nf6'],
    planRu: 'Симметричный встречный удар по центру. Чёрные уклоняются от пассивной защиты пешки e5 и сразу атакуют белую пешку e4.',
  },
  {
    eco: 'C43',
    nameRu: 'Русская партия',
    nameEn: 'Petrov Defence',
    variationRu: 'Современная атака (3. d4)',
    moves: ['e4', 'e5', 'Nf3', 'Nf6', 'd4', 'Nxe4', 'Bd3', 'd5', 'Nxe5'],
    planRu: 'Острая схватка за центральные форпосты e4 и e5 с ранней активностью тяжёлых фигур.',
  },
  {
    eco: 'C30',
    nameRu: 'Королевский гамбит',
    nameEn: "King's Gambit",
    moves: ['e4', 'e5', 'f4'],
    planRu: 'Романтическая атака. Белые отвлекают пешку e5 для создания мощного пешечного центра и вскрытия вертикали «f» для ладьи.',
  },
  {
    eco: 'C34',
    nameRu: 'Королевский гамбит',
    nameEn: "King's Gambit Accepted",
    variationRu: 'Принятый гамбит коня',
    moves: ['e4', 'e5', 'f4', 'exf4', 'Nf3'],
    planRu: 'Белые препятствуют шаху ферзем Qh4+ и развивают фигуру для захвата центра ходом d4.',
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
    eco: 'C48',
    nameRu: 'Дебют четырех коней',
    nameEn: 'Four Knights Game',
    variationRu: 'Испанский вариант (4. Bb5)',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6', 'Bb5'],
    planRu: 'Белые оказывают косвенное давление на коня c6 и пешку e5 по аналогии с Испанской партией.',
  },
  {
    eco: 'C41',
    nameRu: 'Защита Филидора',
    nameEn: 'Philidor Defence',
    moves: ['e4', 'e5', 'Nf3', 'd6'],
    planRu: 'Прочное, но слегка стесненное построение чёрных. Белые захватывают пространство ходом d4, чёрные маневрируют фигурами на первых рядах.',
  },

  // =================================================================
  // 1. e4 c5 (Сицилианская защита)
  // =================================================================
  {
    eco: 'B90',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Вариант Найдорфа',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    planRu: 'Острейшая асимметричная битва. Ход a6 берёт под контроль поле b5 и готовит фигурную экспансию на ферзевом фланге (b5, Bb7, Nbd7).',
  },
  {
    eco: 'B92',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Найдорф: Классическая система (6. Be2)',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be2', 'e5', 'Nb3', 'Be7', 'O-O', 'O-O'],
    planRu: 'Позиционная система Карпова. Белые контролируют поля d5 и f5, чёрные гармонично развивают фигуры.',
  },
  {
    eco: 'B70',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Вариант Дракона',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'],
    planRu: 'Фианкетто слона на g7 образует огневую диагональ «дракона». Острая фигурная борьба на встречных курсах.',
  },
  {
    eco: 'B75',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Дракон: Югославская атака',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'f3', 'O-O', 'Qd2', 'Nc6', 'Bc4'],
    planRu: 'Разносторонние рокировки. Белые штурмуют пешками h4-h5 и слоном Bh6, чёрные контратакуют по вертикали «c».',
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
    variationRu: 'Вариант Паульсена (Кана)',
    moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'a6'],
    planRu: 'Гибкая дебютная система. Чёрные избегают раннего размена фигур и развивают ферзевый фланг с опорой на полуоткрытую вертикаль «c».',
  },
  {
    eco: 'B45',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Вариант Тайманова',
    moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'Nc6', 'Nc3', 'a6'],
    planRu: 'Гармоничное развитие лёгких фигур. Чёрные быстро выводят Qc7, Nf6 и Be7 без структурных слабостей.',
  },
  {
    eco: 'B22',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Вариант Алапина (2. c3)',
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
    eco: 'B30',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Атака Россолимо (3. Bb5)',
    moves: ['e4', 'c5', 'Nf3', 'Nc6', 'Bb5'],
    planRu: 'Белые угрожают испортить пешечную структуру чёрных ходом Bxc6 и уклоняются от основных теоретических дебютных дебрей.',
  },
  {
    eco: 'B52',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    variationRu: 'Московский вариант (3. Bb5+)',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'Bb5+'],
    planRu: 'Шах слоном ведет к быстрому размену легких фигур и гармоничной позиционной игре без тактического риска.',
  },
  {
    eco: 'B20',
    nameRu: 'Сицилианская защита',
    nameEn: 'Sicilian Defence',
    moves: ['e4', 'c5'],
    planRu: 'Борьба за центр с фланга. Чёрные разменивают боковую пешку «c» на центральную белую «d», получая полуоткрытую вертикаль «c» и пешечный перевес в центре.',
  },

  // =================================================================
  // 1. e4 e6 (Французская защита)
  // =================================================================
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
    variationRu: 'Продвинутая система (3. e5)',
    moves: ['e4', 'e6', 'd4', 'd5', 'e5'],
    planRu: 'Белые фиксируют перевес в пространстве пешечным клином e5. Чёрные систематически подрывают базу пешечной цепи ходами c5, Nc6, Qb6.',
  },
  {
    eco: 'C05',
    nameRu: 'Французская защита',
    nameEn: 'French Defence',
    variationRu: 'Вариант Тарраша (3. Nd2)',
    moves: ['e4', 'e6', 'd4', 'd5', 'Nd2'],
    planRu: 'Белые избегают связки слоном Bb4, сохраняя пешечный центр цельным и поддерживая гибкость расстановки фигур.',
  },
  {
    eco: 'C11',
    nameRu: 'Французская защита',
    nameEn: 'French Defence',
    variationRu: 'Классическая система (3... Nf6)',
    moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6'],
    planRu: 'Чёрные атакуют пешку e4. Белые отвечают Bg5 (связка) или e5 (захват пространства с переводом коня на d7).',
  },
  {
    eco: 'C00',
    nameRu: 'Французская защита',
    nameEn: 'French Defence',
    moves: ['e4', 'e6'],
    planRu: 'Крепкая позиционная крепость. Чёрные готовят удар по центру d5 с опорой на пешку e6, перенося борьбу на закрытую структуру.',
  },

  // =================================================================
  // 1. e4 c6 (Защита Каро-Канн)
  // =================================================================
  {
    eco: 'B18',
    nameRu: 'Защита Каро-Канн',
    nameEn: 'Caro-Kann Defence',
    variationRu: 'Классическая система (Капабланки)',
    moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'],
    planRu: 'Чёрные гармонично развивают белопольного слона за пределы пешечной цепи перед ходом e6, получая безопасную и прочную позицию.',
  },
  {
    eco: 'B12',
    nameRu: 'Защита Каро-Канн',
    nameEn: 'Caro-Kann Defence',
    variationRu: 'Атака передовой пешки (3. e5)',
    moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5'],
    planRu: 'Белые захватывают пространство на королевском фланге, чёрные выводят слона на f5 и готовят подрыв пешечной цепи ходом c5.',
  },
  {
    eco: 'B14',
    nameRu: 'Защита Каро-Канн',
    nameEn: 'Caro-Kann Defence',
    variationRu: 'Атака Панова',
    moves: ['e4', 'c6', 'd4', 'd5', 'exd5', 'cxd5', 'c4'],
    planRu: 'Белые вскрывают центральные вертикали и получают изолированную ферзевую пешку с открытыми линиями для фигурной атаки.',
  },
  {
    eco: 'B10',
    nameRu: 'Защита Каро-Канн',
    nameEn: 'Caro-Kann Defence',
    moves: ['e4', 'c6'],
    planRu: 'Сверхнадёжный фундамент. Чёрные готовят ход d5 без запирания белопольного слона c8.',
  },

  // =================================================================
  // Другие полуоткрытые дебюты (Скандинавская, Алехина, Пирца)
  // =================================================================
  {
    eco: 'B01',
    nameRu: 'Скандинавская защита',
    nameEn: 'Scandinavian Defence',
    moves: ['e4', 'd5'],
    planRu: 'Прямой удар по центру на 1-м ходу. Чёрные ликвидируют пешку e4 и быстро развивают свои фигуры.',
  },
  {
    eco: 'B01',
    nameRu: 'Скандинавская защита',
    nameEn: 'Scandinavian Defence',
    variationRu: 'Главная линия (2... Qxd5 3. Nc3 Qa5)',
    moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5'],
    planRu: 'Ферзь отступает в безопасную гавань на a5. Чёрные развивают коней, слонов на f5 и готовят длинную рокировку.',
  },
  {
    eco: 'B02',
    nameRu: 'Защита Алехина',
    nameEn: "Alekhine's Defence",
    moves: ['e4', 'Nf6'],
    planRu: 'Гипермодернистская стратегия. Конь провоцирует белые пешки на выдвижение вперёд, чтобы затем подвергнуть их фигурной осаде.',
  },
  {
    eco: 'B07',
    nameRu: 'Защита Пирца-Уфимцева',
    nameEn: 'Pirc Defence',
    moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'],
    planRu: 'Чёрные отдают белым центр и фианкеттируют слона на g7 для нанесения контрударов c5 или e5.',
  },

  // =================================================================
  // 1. d4 d5 (Закрытые дебюты: Ферзевый гамбит, Лондонская система)
  // =================================================================
  {
    eco: 'D02',
    nameRu: 'Лондонская система',
    nameEn: 'London System',
    variationRu: 'Классическая расстановка',
    moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4', 'e6', 'e3', 'c5', 'c3'],
    planRu: 'Железный треугольник белых пешек c3-d4-e3 с активным слоном на f4 и сильным форпостом для коня на Ne5.',
  },
  {
    eco: 'D02',
    nameRu: 'Лондонская система',
    nameEn: 'London System',
    moves: ['d4', 'Nf6', 'Bf4'],
    planRu: 'Универсальное построение белых с контролем пункта e5 и устойчивой пешечной структурой.',
  },
  {
    eco: 'D00',
    nameRu: 'Дебют ферзевых пешек',
    nameEn: "Queen's Pawn Game",
    moves: ['d4', 'd5'],
    planRu: 'Классический паритет в центре. Борьба за центральные поля d4, d5, e4, e5.',
  },
  {
    eco: 'D06',
    nameRu: 'Ферзевый гамбит',
    nameEn: "Queen's Gambit",
    moves: ['d4', 'd5', 'c4'],
    planRu: 'Белые предлагают размен пешки c4 ради захвата центра ходом e4 и вскрытия линий для своих фигур.',
  },
  {
    eco: 'D20',
    nameRu: 'Принятый ферзевый гамбит',
    nameEn: "Queen's Gambit Accepted",
    moves: ['d4', 'd5', 'c4', 'dxc4'],
    planRu: 'Чёрные забирают пешку c4, но не стремятся её удерживать, взамен подрывая центр ходами c5 и e6.',
  },
  {
    eco: 'D30',
    nameRu: 'Отказанный ферзевый гамбит',
    nameEn: "Queen's Gambit Declined",
    moves: ['d4', 'd5', 'c4', 'e6'],
    planRu: 'Монолитная крепость в центре. Пешка d5 надёжно подкреплена, чёрные готовят гармоничное развитие королевского фланга.',
  },
  {
    eco: 'D35',
    nameRu: 'Отказанный ферзевый гамбит',
    nameEn: "Queen's Gambit Declined",
    variationRu: 'Разменная система',
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'cxd5', 'exd5', 'Bg5', 'c6', 'e3'],
    planRu: 'Карлсбадская структура. Белые готовят пешечное меньшинство на ферзевом фланге (b4-b5), чёрные атакуют короля на королевском.',
  },
  {
    eco: 'D37',
    nameRu: 'Отказанный ферзевый гамбит',
    nameEn: "Queen's Gambit Declined",
    variationRu: 'Классическая система',
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'Be7', 'Bf4', 'O-O'],
    planRu: 'Белые выводят чернопольного слона на активную позицию f4 перед закрытием пешечной цепи ходом e3.',
  },
  {
    eco: 'D10',
    nameRu: 'Славянская защита',
    nameEn: 'Slav Defence',
    moves: ['d4', 'd5', 'c4', 'c6'],
    planRu: 'Чёрные укрепляют центр пешкой c6, сохраняя открытой диагональ c8-h3 для своего белопольного слона.',
  },
  {
    eco: 'D15',
    nameRu: 'Славянская защита',
    nameEn: 'Slav Defence',
    variationRu: 'Главная линия (3. Nf3 Nf6 4. Nc3 dxc4)',
    moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4'],
    planRu: 'Острая позиционная борьба. Чёрные временно забирают пешку c4 и выводят слона на f5, белые отыгрывают пешку ходом a4 и e4.',
  },
  {
    eco: 'D45',
    nameRu: 'Полуславянская защита',
    nameEn: 'Semi-Slav Defence',
    moves: ['d4', 'd5', 'c4', 'c6', 'Nc3', 'Nf6', 'Nf3', 'e6'],
    planRu: 'Сверхпрочный двойной пешечный редут c6-d5-e6. Белые давят в центре, чёрные готовы к тактическому контрудару.',
  },
  {
    eco: 'D46',
    nameRu: 'Полуславянская защита',
    nameEn: 'Semi-Slav Defence',
    variationRu: 'Меранский вариант',
    moves: ['d4', 'd5', 'c4', 'c6', 'Nc3', 'Nf6', 'Nf3', 'e6', 'e3', 'Nbd7', 'Bd3', 'dxc4', 'Bxc4', 'b5'],
    planRu: 'Чёрные захватывают пространство на ферзевом фланге ходом b5 и фианкеттируют слона Bb7, готовя подрыв c5.',
  },

  // =================================================================
  // 1. d4 Nf6 (Индийские защиты, Грюнфельд, Каталон)
  // =================================================================
  {
    eco: 'E60',
    nameRu: 'Староиндийская защита',
    nameEn: "King's Indian Defence",
    moves: ['d4', 'Nf6', 'c4', 'g6'],
    planRu: 'Чёрные уступают белым пешечный центр, чтобы в дальнейшем атаковать его ходами e5 или c5 с активным слоном g7.',
  },
  {
    eco: 'E61',
    nameRu: 'Староиндийская защита',
    nameEn: "King's Indian Defence",
    variationRu: 'Главная классическая линия',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O'],
    planRu: 'Классическая завязка. Белые строят мощный центр d4-e4-c4, чёрные готовят пешечный таран e7-e5.',
  },
  {
    eco: 'E97',
    nameRu: 'Староиндийская защита',
    nameEn: "King's Indian Defence",
    variationRu: 'Вариант Мар-дель-Плата',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7'],
    planRu: 'Легендарная закрытая битва на взаимное уничтожение. Белые штурмуют ферзевый фланг c4-c5, чёрные штурмуют короля ходами f5-f4-g5-g4.',
  },
  {
    eco: 'E20',
    nameRu: 'Защита Нимцовича',
    nameEn: 'Nimzo-Indian Defence',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
    planRu: 'Связка коня c3 нейтрализует влияние белых на центральное поле e4 и угрожает сдвоением белых пешек bxc3.',
  },
  {
    eco: 'E32',
    nameRu: 'Защита Нимцовича',
    nameEn: 'Nimzo-Indian Defence',
    variationRu: 'Классическая система (Капабланки 4. Qc2)',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'O-O', 'a3', 'Bxc3+', 'Qxc3'],
    planRu: 'Белые избегают сдвоения пешек, забирая ферзем, и сохраняют преимущество двух слонов.',
  },
  {
    eco: 'E12',
    nameRu: 'Новоиндийская защита',
    nameEn: "Queen's Indian Defence",
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'],
    planRu: 'Контроль над ключевым центральным полем e4 через фианкетто слона на b7 и коня f6.',
  },
  {
    eco: 'E00',
    nameRu: 'Каталонское начало',
    nameEn: 'Catalan Opening',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2'],
    planRu: 'Синтез Ферзевого гамбита и Рети. Каталонский белопольный слон на g2 оказывает мощнейшее скрытое давление по всей диагонали h1-a8.',
  },
  {
    eco: 'D80',
    nameRu: 'Защита Грюнфельда',
    nameEn: 'Grunfeld Defence',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'],
    planRu: 'Философия гипермодернизма: чёрные отдают белым центр ради скорейшего фигурного давления на пешку d4 ходами Bg7 и c5.',
  },
  {
    eco: 'D85',
    nameRu: 'Защита Грюнфельда',
    nameEn: 'Grunfeld Defence',
    variationRu: 'Разменная система',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4', 'Nxc3', 'bxc3', 'Bg7'],
    planRu: 'Белые получают огромный пешечный центр c3-d4-e4. Чёрные систематически расшатывают его ударами c5, Nc6, Bg4.',
  },
  {
    eco: 'A57',
    nameRu: 'Волжский гамбит (Гамбит Бенко)',
    nameEn: 'Benko Gambit',
    moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5'],
    planRu: 'Позиционная жертва пешки b5 ради долговременного непрерывного давления по полуоткрытым вертикалям «a» и «b».',
  },
  {
    eco: 'A80',
    nameRu: 'Голландская защита',
    nameEn: 'Dutch Defence',
    moves: ['d4', 'f5'],
    planRu: 'Бескомпромиссная асимметричная защита. Чёрные сразу берут под контроль центральный пункт e4 пешкой f5.',
  },

  // =================================================================
  // Фланговые начала (Английское, Рети)
  // =================================================================
  {
    eco: 'A10',
    nameRu: 'Английское начало',
    nameEn: 'English Opening',
    moves: ['c4'],
    planRu: 'Белые берут под контроль центральное поле d5 с фланга, сохраняя гибкость для перехода в самые разные дебютные системы.',
  },
  {
    eco: 'A20',
    nameRu: 'Английское начало',
    nameEn: 'English Opening',
    variationRu: 'Сицилианская защита в первой руке (1... e5)',
    moves: ['c4', 'e5'],
    planRu: 'Перевёрнутая Сицилианская защита, где у белых лишний темп. Белые развивают Nc3 и фианкеттируют слона g3.',
  },
  {
    eco: 'A30',
    nameRu: 'Английское начало',
    nameEn: 'English Opening',
    variationRu: 'Симметричный вариант (1... c5)',
    moves: ['c4', 'c5'],
    planRu: 'Плотная маневренная стратегическая борьба за поля d4 и d5 без немедленного прямого контакта пешек.',
  },
  {
    eco: 'A04',
    nameRu: 'Дебют Рети',
    nameEn: 'Reti Opening',
    moves: ['Nf3'],
    planRu: 'Гибкое развитие коня, сохраняющее выбор пешечных структур и контролирующее центр e5 и d4.',
  },
  {
    eco: 'A09',
    nameRu: 'Дебют Рети',
    nameEn: 'Reti Opening',
    variationRu: 'Гамбит Рети (1. Nf3 d5 2. c4)',
    moves: ['Nf3', 'd5', 'c4'],
    planRu: 'Гипермодернистская стратегия фигурного давления на центр соперника без раннего выдвижения пешек d2 и e2.',
  },
  {
    eco: 'B06',
    nameRu: 'Современная защита (Робача)',
    nameEn: 'Modern Defence',
    moves: ['e4', 'g6', 'd4', 'Bg7'],
    planRu: 'Универсальная контрсистема с фианкетто слона g7. Чёрные реагируют на расстановку белых гибкими ходами c6, d6 или e5.',
  },
];

/**
 * Вспомогательное форматирование сыгранной цепочки ходов SAN в стандартную нотацию
 */
export function formatMovesSan(moves: string[]): string {
  if (!moves || moves.length === 0) return '—';
  const parts: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    const w = moves[i];
    const b = moves[i + 1] ? ` ${moves[i + 1]}` : '';
    parts.push(`${num}. ${w}${b}`);
  }
  return parts.join('  ');
}

/**
 * Распознавание дебюта по сыгранной цепочке ходов (SAN) с вариациями и продолжениями
 */
export function detectOpening(movesSan: string[]): RecognizedOpening {
  if (!movesSan || movesSan.length === 0) {
    // Предлагаем основные первые ходы
    const initialContinuations: OpeningContinuation[] = [
      { moveSan: 'e4', eco: 'C00', nameRu: 'Открытые дебюты', variationRu: 'Королевская пешка' },
      { moveSan: 'd4', eco: 'D00', nameRu: 'Закрытые дебюты', variationRu: 'Ферзевая пешка' },
      { moveSan: 'c4', eco: 'A10', nameRu: 'Английское начало' },
      { moveSan: 'Nf3', eco: 'A04', nameRu: 'Дебют Рети' },
    ];

    return {
      eco: 'A00',
      nameRu: 'Начальная позиция',
      nameEn: 'Starting Position',
      movesSan: '—',
      playedMovesSan: '—',
      bookMovesSan: '—',
      planRu: 'Борьба за захват центра, гармоничное развитие лёгких фигур и обеспечение безопасности короля (рокировка).',
      stage: 'start',
      stageLabelRu: 'Начало',
      continuations: initialContinuations,
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
      // Частичное совпадение (партия в самом начале, ходов меньше, чем в ветке)
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

  // Находим возможные теоретические продолжения из текущей позиции
  const continuationsMap = new Map<string, OpeningContinuation>();
  for (const entry of OPENINGS_DATABASE) {
    if (entry.moves.length > movesSan.length) {
      let match = true;
      for (let i = 0; i < movesSan.length; i++) {
        if (movesSan[i] !== entry.moves[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        const nextMove = entry.moves[movesSan.length];
        if (!continuationsMap.has(nextMove)) {
          continuationsMap.set(nextMove, {
            moveSan: nextMove,
            eco: entry.eco,
            nameRu: entry.nameRu,
            variationRu: entry.variationRu,
          });
        }
      }
    }
  }
  const continuations = Array.from(continuationsMap.values()).slice(0, 4);

  const playedFormatted = formatMovesSan(movesSan);

  if (!bestMatch) {
    // Нестандартное начало
    return {
      eco: 'A00',
      nameRu: 'Нестандартный дебют',
      nameEn: 'Uncommon Opening',
      movesSan: playedFormatted,
      playedMovesSan: playedFormatted,
      bookMovesSan: '—',
      planRu: 'Оригинальная расстановка фигур вне основных классических дебютных канонов. Стремитесь к контролю центра и ранней рокировке.',
      stage: movesSan.length > 8 ? 'middlegame' : 'theory',
      stageLabelRu: movesSan.length > 8 ? 'Миттельшпиль' : 'Вне теории',
      continuations: [],
      plyCount: movesSan.length,
    };
  }

  const bookFormatted = formatMovesSan(bestMatch.moves);
  const isMiddlegame = movesSan.length > bestMatch.moves.length + 3;

  return {
    eco: bestMatch.eco,
    nameRu: bestMatch.nameRu,
    nameEn: bestMatch.nameEn,
    variationRu: bestMatch.variationRu,
    // movesSan содержит актуальные ходы всей партии для показа в интерфейсе
    movesSan: playedFormatted,
    playedMovesSan: playedFormatted,
    bookMovesSan: bookFormatted,
    planRu: bestMatch.planRu,
    stage: isMiddlegame ? 'middlegame' : 'theory',
    stageLabelRu: isMiddlegame ? 'Миттельшпиль' : (continuations.length > 0 ? 'Теория' : 'Окончание теории'),
    continuations,
    plyCount: movesSan.length,
  };
}
