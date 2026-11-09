'use strict';

/**
 * Інтерактивна вебсистема діагностики несправностей ПК
 * Клієнтська частина: DOM, події, localStorage, ES6+.
 */

let STORAGE = {
  faults: 'pcDiag.faults',
  role: 'pcDiag.role',
};

let ADMIN_LOGIN = { name: 'admin', password: 'admin' };

let CATEGORIES = [
  'Блок живлення',
  'Материнська плата',
  'Оперативна пам\'ять',
  'Відеокарта',
  'Накопичувачі',
  'Охолодження',
  'BIOS / CMOS',
];

let SEVERITY_RANK = { low: 1, medium: 2, high: 3 };
let SEVERITY_LABEL = { low: 'Низький', medium: 'Середній', high: 'Високий' };

/** Кількість записів на сторінку в таблиці адмін-панелі. */
let ADMIN_PAGE_SIZE = 6;

/** Початковий масив несправностей (імітація БД). */
let DEFAULT_FAULTS = [
  {
    id: 'psu-dead',
    category: 'Блок живлення',
    symptom: 'Комп\'ютер повністю «мертвий»: немає індикаторів і обертання вентиляторів',
    severity: 'high',
    cause: 'Немає вихідної напруги БЖ через відмову первинного каскаду, запобіжника або кабелю живлення.',
    steps: [
      'Перевірте мережевий кабель, розетку та вимикач на задній панелі БЖ.',
      'Спробуйте інший кабель живлення та іншу розетку.',
      'Від\'єднайте зайве навантаження (диски, додаткові вентилятори).',
      'Перевірте, чи світиться індикатор standby на материнській платі.',
      'Замініть БЖ на завідомо справний для підтвердження діагнозу.',
    ],
    tags: ['power', 'no-led', 'psu'],
  },
  {
    id: 'psu-overload',
    category: 'Блок живлення',
    symptom: 'Мимовільне вимкнення під навантаженням (ігри, рендер)',
    severity: 'high',
    cause: 'БЖ не витримує пікове споживання GPU/CPU або деградувала лінія +12 В.',
    steps: [
      'Зніміть пікове споживання системи та порівняйте з номіналом БЖ.',
      'Перевірте температуру БЖ і роботу його вентилятора.',
      'Тимчасово знизьте частоти GPU/CPU і перевірте стабільність.',
      'Замініть БЖ на модель із запасом потужності 20–30%.',
    ],
    tags: ['shutdown', 'load', 'psu'],
  },
  {
    id: 'psu-click',
    category: 'Блок живлення',
    symptom: 'Клацання реле / коротке смикання вентиляторів без старту',
    severity: 'medium',
    cause: 'Захист БЖ (OCP/SCP) спрацьовує через КЗ на лінії 12/5/3.3 В.',
    steps: [
      'Вимкніть живлення і вийміть шнур на 2–3 хвилини.',
      'Відключіть по черзі GPU, диски та USB-пристрої.',
      'Огляньте 24-pin і 8-pin CPU на сліди підгоряння.',
      'Якщо старт з\'являється після відключення компонента — шукайте КЗ в ньому.',
    ],
    tags: ['power', 'click', 'psu', 'short'],
  },
  {
    id: 'mb-nopost',
    category: 'Материнська плата',
    symptom: 'Живлення є, вентилятори крутяться, але немає POST і сигналу на монітор',
    severity: 'high',
    cause: 'Не проходить ініціалізація чіпсета/CPU: пошкоджена плата, сокет або прошивка.',
    steps: [
      'Скиньте CMOS перемичкою або вийнявши батарейку на 10 хвилин.',
      'Залиште мінімальну конфігурацію: CPU, 1 планка RAM, вбудоване відео.',
      'Перевірте індикатори DEBUG (CPU/DRAM/VGA/BOOT).',
      'Огляньте сокет і VRM на здуття конденсаторів і підгоряння.',
    ],
    tags: ['display', 'nopost', 'mb', 'power-ok'],
  },
  {
    id: 'mb-usb',
    category: 'Материнська плата',
    symptom: 'Порти USB на задній панелі не живлять клавіатуру/мишу',
    severity: 'medium',
    cause: 'Відмова південного моста, контролера USB або пошкоджена доріжка +5VSB.',
    steps: [
      'Перевірте пристрої в передніх портах корпуса і на USB-хабі.',
      'У BIOS увімкніть USB legacy support і xHCI hand-off.',
      'Перевстановіть драйвери чіпсета після завантаження з PS/2 або іншої плати.',
      'Якщо порти мертві ще до POST — ймовірна апаратна відмова плати.',
    ],
    tags: ['usb', 'mb', 'peripherals'],
  },
  {
    id: 'mb-short',
    category: 'Материнська плата',
    symptom: 'КЗ: плата не стартує, БЖ одразу йде в захист після натискання Power',
    severity: 'high',
    cause: 'Коротке замикання на PCB, стоєчних гвинтах корпуса або в сокеті.',
    steps: [
      'Зніміть плату з корпуса і запустіть на ізольованій поверхні (bench test).',
      'Перевірте, чи не замикає задню панель I/O shield.',
      'Огляньте сокет CPU на погнуті контакти.',
      'Виключіть сторонні плати розширення та RGB-контролери.',
    ],
    tags: ['short', 'power', 'mb', 'click'],
  },
  {
    id: 'ram-beep',
    category: 'Оперативна пам\'ять',
    symptom: 'Безперервний або повторюваний звуковий сигнал BIOS під час старту',
    severity: 'high',
    cause: 'Модулі RAM не ініціалізуються: нещільна посадка, несумісність або відмова DIMM.',
    steps: [
      'Вимкніть ПК, вийміть усі планки і встановіть одну в слот A2.',
      'Протріть контакти ластиком і перевірте фіксатори слотів.',
      'Спробуйте інший слот і інший модуль по черзі.',
      'Скиньте XMP/EXPO до стандартних JEDEC-частот.',
    ],
    tags: ['beep', 'ram', 'nopost', 'display'],
  },
  {
    id: 'ram-bsod',
    category: 'Оперативна пам\'ять',
    symptom: 'Сині екрани, випадкові ребуту під час роботи з великими файлами',
    severity: 'medium',
    cause: 'Помилки ECC/нестабільність модулів або занадто агресивний XMP-профіль.',
    steps: [
      'Запустіть MemTest86 або Windows Memory Diagnostic на кілька проходів.',
      'Вимкніть XMP і перевірте стабільність на базовій частоті.',
      'Тестуйте планки по одній, щоб знайти дефектний модуль.',
      'Оновіть BIOS материнської плати для покращення сумісності RAM.',
    ],
    tags: ['bsod', 'stability', 'ram', 'reboot'],
  },
  {
    id: 'ram-capacity',
    category: 'Оперативна пам\'ять',
    symptom: 'Система бачить лише частину встановленого обсягу пам\'яті',
    severity: 'low',
    cause: 'Модуль не визначено в одному зі слотів або активована інтегрована графіка з резервом RAM.',
    steps: [
      'Перевірте обсяг у BIOS і в диспетчері завдань.',
      'Переставте планки місцями, дотримуючись dual-channel схеми.',
      'Вимкніть iGPU Shared Memory, якщо використовуєте дискретну відеокарту.',
      'Оновіть BIOS і скиньте налаштування пам\'яті.',
    ],
    tags: ['ram', 'capacity'],
  },
  {
    id: 'gpu-nosignal',
    category: 'Відеокарта',
    symptom: 'Немає зображення на моніторі, індикатор GPU світиться',
    severity: 'high',
    cause: 'Картка не ініціалізується: відмова BIOS GPU, живлення PCIe або кабель монітора в інтегрований порт.',
    steps: [
      'Переконайтесь, що кабель монітора підключено саме до відеокарти, а не до плати.',
      'Перевірте додаткові 6/8-pin кабелі живлення GPU.',
      'Спробуйте інший порт (DisplayPort/HDMI) і інший кабель.',
      'Запустіть систему з інтегрованої графіки, вийнявши дискретну карту.',
    ],
    tags: ['display', 'gpu', 'nosignal', 'power-ok'],
  },
  {
    id: 'gpu-artifacts',
    category: 'Відеокарта',
    symptom: 'Артефакти, «биті» текстури та вильоти драйвера в 3D',
    severity: 'high',
    cause: 'Перегрів GPU/VRAM, деградація чипа або нестабільне живлення карти.',
    steps: [
      'Моніторте температуру GPU під навантаженням (норма до ~85–90 °C).',
      'Очистіть радіатор і за потреби замініть термопасту/термопрокладки.',
      'Знизьте частоти через MSI Afterburner для перевірки стабільності.',
      'Перевстановіть драйвер через DDU в безпечному режимі.',
    ],
    tags: ['artifacts', 'gpu', 'stability', 'thermal'],
  },
  {
    id: 'gpu-driver',
    category: 'Відеокарта',
    symptom: 'Чорний екран на кілька секунд із повідомленням про відновлення драйвера',
    severity: 'medium',
    cause: 'Конфлікт драйверів, TDR Windows або нестабільність карти на стокових частотах.',
    steps: [
      'Оновіть або відкотіть драйвер GPU до перевіреної версії.',
      'Вимкніть апаратне прискорення в браузері та Discord для тесту.',
      'Перевірте журнал подій Windows на помилки Display.',
      'Протестуйте карту в іншому ПК, якщо є така можливість.',
    ],
    tags: ['gpu', 'driver', 'display'],
  },
  {
    id: 'hdd-click',
    category: 'Накопичувачі',
    symptom: 'Клацання HDD, диски зникають з BIOS',
    severity: 'high',
    cause: 'Механічна відмова блоку головок або проблеми з каналом SATA/живленням диска.',
    steps: [
      'Негайно скопіюйте критичні дані, якщо диск ще визначається.',
      'Замініть SATA-кабель і порт на материнській платі.',
      'Перевірте живлення SATA power від БЖ.',
      'Не відкривайте гермозону самостійно — за потреби зверніться до сервісу.',
    ],
    tags: ['storage', 'click', 'hdd', 'boot'],
  },
  {
    id: 'ssd-notfound',
    category: 'Накопичувачі',
    symptom: 'Повідомлення «Reboot and Select proper Boot device» / диск не в Boot Menu',
    severity: 'medium',
    cause: 'Втрачено завантажувач, вимкнено CSM/UEFI режим або відмовив накопичувач.',
    steps: [
      'Перевірте, чи диск видно в BIOS як пристрій.',
      'Установіть режим UEFI/Legacy відповідно до способу встановлення ОС.',
      'Відновіть завантажувач (bcdboot / grub) із інсталяційного носія.',
      'Перевірте SMART і стан NVMe/SATA в діагностичній утиліті.',
    ],
    tags: ['storage', 'boot', 'ssd', 'bios'],
  },
  {
    id: 'ssd-slow',
    category: 'Накопичувачі',
    symptom: 'Система «зависає» на кілька секунд, високе навантаження диска на 100%',
    severity: 'medium',
    cause: 'Деградація TLC/QLC NAND, закінчився DRAM-кеш SSD або тло Windows Search/антивірусу.',
    steps: [
      'Перевірте вільне місце (бажано >15%) і стан SMART.',
      'Оновіть прошивку SSD і драйвер накопичувача.',
      'Вимкніть зайві служби індексації для тесту.',
      'Розгляньте клонування на новий SSD, якщо reallocated sectors зростають.',
    ],
    tags: ['storage', 'slow', 'ssd', 'stability'],
  },
  {
    id: 'cool-shutdown',
    category: 'Охолодження',
    symptom: 'Вимкнення через кілька хвилин роботи, корпус дуже гарячий',
    severity: 'high',
    cause: 'Термотrottling/thermal shutdown CPU або VRM через висохлу пасту чи зупинку вентилятора.',
    steps: [
      'Перевірте обертання CPU-кулера і системних вентиляторів.',
      'Почистіть радіатори від пилу, замініть термопасту.',
      'Контролюйте температури в BIOS Hardware Monitor.',
      'Перевірте правильність монтажу кулера і притиск сокета.',
    ],
    tags: ['thermal', 'shutdown', 'cooling', 'load'],
  },
  {
    id: 'cool-noise',
    category: 'Охолодження',
    symptom: 'Сильний шум вентиляторів навіть у простої',
    severity: 'low',
    cause: 'Профіль вентиляторів у BIOS виставлено на Full Speed або зношений підшипник.',
    steps: [
      'У BIOS оберіть профіль Silent/Normal і криву PWM.',
      'Підключіть вентилятори до SYS_FAN, а не до роз\'ємів без регулювання.',
      'Огляньте лопаті на дисбаланс і пил.',
      'Замініть вентилятор, якщо є скрегіт підшипника.',
    ],
    tags: ['thermal', 'noise', 'cooling'],
  },
  {
    id: 'cmos-time',
    category: 'BIOS / CMOS',
    symptom: 'Щоразу скидається час, дата і налаштування BIOS',
    severity: 'low',
    cause: 'Сіла батарейка CR2032, через що CMOS-пам\'ять не утримує конфігурацію.',
    steps: [
      'Запишіть важливі налаштування BIOS (режим дисків, XMP, boot order).',
      'Замініть батарейку CR2032, дотримуючись полярності.',
      'Увімкніть ПК, зайдіть у BIOS і збережіть профіль.',
      'Перевірте, чи годинник тримається після повного вимкнення зі стіни.',
    ],
    tags: ['bios', 'cmos', 'time'],
  },
  {
    id: 'bios-beep-long',
    category: 'BIOS / CMOS',
    symptom: 'Безперервний звуковий сигнал BIOS одразу після подачі живлення',
    severity: 'high',
    cause: 'Класичний код багатьох AMI/Award: критична помилка RAM або відсутність модулів.',
    steps: [
      'Зверніться до таблиці beep-кодів виробника материнської плати.',
      'Перевірте RAM за методикою мінімальної конфігурації.',
      'Скиньте CMOS і вимкніть Fast Boot.',
      'Якщо сигнал лишається без RAM — діагностуйте плату.',
    ],
    tags: ['beep', 'bios', 'ram', 'nopost'],
  },
  {
    id: 'boot-loop',
    category: 'Материнська плата',
    symptom: 'Циклічне вмикання/вимикання без завантаження (power loop)',
    severity: 'high',
    cause: 'Нестабільне живлення CPU 8-pin, невірний BIOS після оновлення або КЗ на лінії EPS.',
    steps: [
      'Перевірте щільність 8-pin CPU і 24-pin ATX.',
      'Спробуйте BIOS Flashback, якщо плата це підтримує.',
      'Запустіть мінімальну конфігурацію поза корпусом.',
      'Виключіть перегрів VRM після попереднього невдалого старту.',
    ],
    tags: ['power', 'reboot', 'mb', 'loop'],
  },
];

/** Префікси кодів записів за категоріями (PWR-001, RAM-003…). */
let CATEGORY_PREFIX = {
  'Блок живлення': 'PWR',
  'Материнська плата': 'MB',
  'Оперативна пам\'ять': 'RAM',
  'Відеокарта': 'GPU',
  'Накопичувачі': 'SSD',
  'Охолодження': 'FAN',
  'BIOS / CMOS': 'BIOS',
};

let CATEGORY_ICON = {
  'Блок живлення': 'bolt',
  'Материнська плата': 'chip',
  'Оперативна пам\'ять': 'memory',
  'Відеокарта': 'monitor',
  'Накопичувачі': 'drive',
  'Охолодження': 'fan',
  'BIOS / CMOS': 'sliders',
};

/** Векторні іконки (stroke, viewBox 24×24). */
let ICON_PATHS = {
  bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3"/>',
  memory: '<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 11.5v1M11 11.5v1M15 11.5v1M6.5 16v2M10.5 16v2M14.5 16v2M18 16v2"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  drive: '<rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 13h.01M11 13h6"/>',
  fan: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10.2C12 6 13 4 15 4s2 3-1 5M13.8 12c4.2 0 6.2 1 6.2 3s-3 2-5.2-1M12 13.8c0 4.2-1 6.2-3 6.2s-2-3 1-5.2M10.2 12C6 12 4 11 4 9s3-2 5.2 1"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
  nodes: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/><path d="M11 7.5h2.5a2 2 0 012 2V13"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/>',
  'shield-check': '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  'user-shield': '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><circle cx="12" cy="10" r="2"/><path d="M8.5 16c.7-2 2-3 3.5-3s2.8 1 3.5 3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'arrow-up-right': '<path d="M7 17L17 7M9 7h8v8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clipboard: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V4h6v1M9.5 11h5M9.5 15h5"/>',
  wrench: '<path d="M15 4a4.5 4.5 0 00-4 6.3L4.5 17a1.8 1.8 0 002.5 2.5l6.7-6.5A4.5 4.5 0 0020 9l-3 3-2.5-.5L14 9l3-3A4.5 4.5 0 0015 4z"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6"/>',
  alert: '<path d="M12 3.5l9.5 16.5h-19L12 3.5z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
};

let RECORD_FORMS = ['запис', 'записи', 'записів'];
let WIZARD_NOTE = 'Відповідь допоможе звузити пошук, але не підтверджує несправність.';

/**
 * Дерево майстра: кожен вузол — запитання, options ведуть далі або до результату.
 * Крок 1 «Симптом» (start) → крок 2 «Уточнення» → крок 3 «Результат».
 * Поле tags накопичується і зіставляється з тегами несправностей.
 */
let WIZARD_NODES = {
  start: {
    title: 'Що спостерігаєте з комп\'ютером?',
    hint: 'Оберіть сценарій, який найбільше схожий на поведінку обладнання.',
    note: 'Можна змінити відповідь пізніше — просто поверніться на крок назад.',
    options: [
      { label: 'Не вмикається', text: 'Не вмикається взагалі', desc: 'Тиша, немає індикаторів і обертання вентиляторів.', next: 'power-q', tags: ['power'] },
      { label: 'Немає зображення', text: 'Немає зображення', desc: 'ПК вмикається, вентилятори працюють, екран залишається чорним.', next: 'display-q', tags: ['display', 'power-ok'] },
      { label: 'Звукові сигнали BIOS', text: 'Звукові сигнали BIOS', desc: 'Безперервний або повторюваний писк під час запуску.', next: 'beep-q', tags: ['beep'] },
      { label: 'Вимкнення / перезапуск', text: 'Мимовільне вимкнення або перезапуск', desc: 'ПК вимикається чи перезавантажується без вашої команди.', next: 'off-q', tags: ['shutdown'] },
      { label: 'Нестабільна робота', text: 'Артефакти, зависання, синій екран', desc: 'Система працює нестабільно: збої, «вильоти», BSOD.', next: 'stab-q', tags: ['stability'] },
      { label: 'ОС і накопичувачі', text: 'Не завантажується ОС / проблеми з дисками', desc: 'Помилки завантаження, диск зникає або «замирає».', next: 'stor-q', tags: ['storage', 'boot'] },
      { label: 'Шум і перегрів', text: 'Сильний шум або перегрів', desc: 'Гучні вентилятори, гарячий корпус, спрацювання захисту.', next: 'therm-q', tags: ['thermal'] },
    ],
  },
  'power-q': {
    title: 'Чи є хоч якісь ознаки живлення?',
    hint: 'Індикатор на материнській платі, підсвітка клавіатури, світлодіод БЖ.',
    options: [
      { text: 'Повністю мертвий', desc: 'Навіть індикатори БЖ і плати не світяться.', next: 'result', tags: ['no-led', 'psu'] },
      { text: 'Клацання реле або смикання вентиляторів', desc: 'Коротка спроба старту, після якої знову тиша.', next: 'result', tags: ['click', 'short', 'psu'] },
      { text: 'Циклічно вмикається і гасне', desc: 'Старт повторюється без завантаження системи.', next: 'result', tags: ['loop', 'mb', 'reboot'] },
    ],
  },
  'display-q': {
    title: 'Що саме відбувається на екрані?',
    hint: 'Перевірте, до якого порту підключено кабель монітора.',
    options: [
      { text: 'Кабель у відеокарті, екран «No Signal»', desc: 'Монітор не отримує сигналу від дискретної відеокарти.', next: 'result', tags: ['gpu', 'nosignal'] },
      { text: 'Немає POST, індикатори RAM/CPU активні', desc: 'Плата зупиняється ще до виведення зображення.', next: 'result', tags: ['nopost', 'mb', 'ram'] },
      { text: 'Зображення є, але з артефактами', desc: 'Смуги, «биті» текстури, спотворені кольори.', next: 'result', tags: ['gpu', 'artifacts'] },
    ],
  },
  'beep-q': {
    title: 'Які сигнали чути під час запуску?',
    hint: 'Виберіть один варіант. Якщо не впевнені, скористайтеся останньою відповіддю.',
    note: 'Коди залежать від виробника BIOS. Відповідь допоможе звузити пошук, але не підтверджує несправність.',
    options: [
      { text: 'Безперервний писк', desc: 'Один довгий сигнал без пауз після подачі живлення.', next: 'result', tags: ['beep', 'ram'] },
      { text: 'Повторювані короткі сигнали', desc: 'Серія однакових сигналів після старту.', next: 'result', tags: ['beep', 'ram', 'bios'] },
      { text: 'Один короткий, але ОС не вантажиться', desc: 'POST пройдено, проблема, імовірно, в завантаженні.', next: 'result', tags: ['boot', 'storage', 'bios'] },
    ],
  },
  'off-q': {
    title: 'Коли саме відбувається вимкнення?',
    hint: 'Це допомагає відділити БЖ від перегріву та програмних причин.',
    options: [
      { text: 'Під навантаженням', desc: 'Ігри, рендер, стрес-тест.', next: 'result', tags: ['load', 'psu', 'thermal'] },
      { text: 'Через кілька хвилин, корпус гарячий', desc: 'Вимкнення після прогріву системи.', next: 'result', tags: ['thermal', 'cooling', 'shutdown'] },
      { text: 'Випадково, навіть у простої', desc: 'Часто завершується синім екраном.', next: 'result', tags: ['ram', 'bsod', 'reboot'] },
    ],
  },
  'stab-q': {
    title: 'Який прояв нестабільності найчастіший?',
    hint: 'Оберіть найближчий варіант — помічник врахує кілька ознак.',
    options: [
      { text: 'Артефакти та виліт драйвера відео', desc: 'Збої у 3D, чорний екран на кілька секунд.', next: 'result', tags: ['gpu', 'artifacts', 'driver'] },
      { text: 'BSOD під час копіювання великих файлів', desc: 'Сині екрани під навантаженням на пам\'ять.', next: 'result', tags: ['ram', 'bsod'] },
      { text: 'Зависання з диском на 100%', desc: 'Система «замирає», індикатор диска перевантажений.', next: 'result', tags: ['storage', 'slow', 'ssd'] },
    ],
  },
  'stor-q': {
    title: 'Що показує BIOS щодо накопичувачів?',
    hint: 'Увійдіть у BIOS або Boot Menu під час старту.',
    options: [
      { text: 'Диск зникає, HDD клацає', desc: 'Накопичувач визначається нестабільно.', next: 'result', tags: ['hdd', 'click', 'storage'] },
      { text: 'Диск є, але «Select proper boot device»', desc: 'Пристрій видно, завантажувач не знайдено.', next: 'result', tags: ['ssd', 'boot', 'bios'] },
      { text: 'ОС вантажиться, але постійно «замирає»', desc: 'Повільна робота та періодичні фризи.', next: 'result', tags: ['ssd', 'slow'] },
    ],
  },
  'therm-q': {
    title: 'Що саме чути або вимірюється?',
    hint: 'Шум без аварійного вимкнення часто вирішується кривою вентиляторів.',
    options: [
      { text: 'Гучні вентилятори навіть у простої', desc: 'Високі оберти без видимого навантаження.', next: 'result', tags: ['noise', 'cooling'] },
      { text: 'Вимкнення на гарячому корпусі', desc: 'Спрацьовує тепловий захист.', next: 'result', tags: ['thermal', 'shutdown', 'cooling'] },
      { text: 'Артефакти після нагріву відеокарти', desc: 'Збої з’являються після тривалого навантаження.', next: 'result', tags: ['gpu', 'thermal', 'artifacts'] },
    ],
  },
};

let state = {
  role: 'guest',
  faults: [],
  view: 'catalog',
  query: '',
  category: 'all',
  sort: 'severity-desc',
  admin: { query: '', page: 1, editingId: null },
  // picks: обрані варіанти [{ nodeId, index }], selected — поточний вибір на кроці
  wizard: { node: 'start', picks: [], selected: null },
};

let $ = (id) => document.getElementById(id);

/* ---------- Утиліти ---------- */

function icon(name, size = 20) {
  let paths = ICON_PATHS[name] || '';
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

/** Підставляє SVG у всі елементи з data-icon. */
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 20);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Українська множина: 1 запис, 2 записи, 5 записів. */
function plural(n, [one, few, many]) {
  let m10 = n % 10;
  let m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function categoryIcon(category) {
  return CATEGORY_ICON[category] || 'chip';
}

/** Код запису: PWR-001 для типових, PWR-4xx для доданих вручну. */
function faultCode(item) {
  let prefix = CATEGORY_PREFIX[item.category] || 'GEN';
  let id = String(item.id);
  let defaultIndex = DEFAULT_FAULTS.findIndex((f) => f.id === id);
  let num = defaultIndex >= 0
    ? defaultIndex + 1
    : 100 + (Number(id.slice(-3)) % 900 || 0);
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

function sevBadge(severity) {
  return `<span class="sev sev-${escapeHtml(severity)}">${SEVERITY_LABEL[severity] || ''}</span>`;
}

/* ---------- Сховище ---------- */

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadFaults() {
  try {
    let raw = localStorage.getItem(STORAGE.faults);
    if (!raw) return cloneData(DEFAULT_FAULTS);
    let parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : cloneData(DEFAULT_FAULTS);
  } catch {
    return cloneData(DEFAULT_FAULTS);
  }
}

function saveFaults() {
  localStorage.setItem(STORAGE.faults, JSON.stringify(state.faults));
}

function loadRole() {
  return localStorage.getItem(STORAGE.role) === 'admin' ? 'admin' : 'guest';
}

/* ---------- Каталог ---------- */

function filteredFaults() {
  let q = state.query.trim().toLowerCase();
  let list = state.faults.filter((item) => {
    let byCat = state.category === 'all' || item.category === state.category;
    let blob = `${item.symptom} ${item.cause} ${item.category} ${faultCode(item)}`.toLowerCase();
    return byCat && (!q || blob.includes(q));
  });

  let byName = (a, b) => a.symptom.localeCompare(b.symptom, 'uk');
  return [...list].sort((a, b) => {
    switch (state.sort) {
      case 'severity-asc': return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || byName(a, b);
      case 'name-asc': return byName(a, b);
      case 'name-desc': return byName(b, a);
      case 'category': return CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || byName(a, b);
      default: return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || byName(a, b);
    }
  });
}

function renderPills() {
  let cats = ['all', ...CATEGORIES];
  $('categoryPills').innerHTML = cats.map((c) => {
    let active = state.category === c;
    return `<button class="pill${active ? ' is-active' : ''}" type="button" data-cat="${escapeHtml(c)}" aria-pressed="${active}">${c === 'all' ? 'Усі категорії' : escapeHtml(c)}</button>`;
  }).join('');
}

function renderCatalog() {
  let list = filteredFaults();
  $('statFaults').textContent = pad2(state.faults.length);
  $('statCats').textContent = pad2(new Set(state.faults.map((f) => f.category)).size);
  $('catalogTitle').textContent = state.category === 'all' ? 'Усі несправності' : state.category;
  $('catalogCount').textContent = `${list.length} ${plural(list.length, RECORD_FORMS)}`;
  $('catalogEmpty').classList.toggle('hidden', list.length > 0);
  renderPills();

  $('catalogGrid').innerHTML = list.map((item) => `
    <article class="fault-card">
      <div class="card-top">
        <span class="card-icon" aria-hidden="true">${icon(categoryIcon(item.category), 20)}</span>
        ${sevBadge(item.severity)}
      </div>
      <div class="card-meta">
        <span>${escapeHtml(item.category)}</span>
        <span class="code">${escapeHtml(faultCode(item))}</span>
      </div>
      <h3>${escapeHtml(item.symptom)}</h3>
      <p>${escapeHtml(item.cause)}</p>
      <button class="card-link" type="button" data-open="${escapeHtml(item.id)}">
        <span>Переглянути рішення</span>${icon('arrow-up-right', 16)}
      </button>
    </article>
  `).join('');
}

function fillSelects() {
  $('formCategory').innerHTML = CATEGORIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

/* ---------- Майстер діагностики ---------- */

function wizardPickedOptions() {
  return state.wizard.picks.map((p) => WIZARD_NODES[p.nodeId].options[p.index]);
}

function wizardTags() {
  return wizardPickedOptions().flatMap((opt) => opt.tags);
}

function renderStepper(step) {
  let labels = ['Симптом', 'Уточнення', 'Результат'];
  $('wizardStepper').innerHTML = labels.map((label, i) => {
    let n = i + 1;
    let cls = n < step ? 'is-done' : n === step ? 'is-current' : '';
    let mark = n < step ? icon('check', 13) : n;
    return `<li class="step ${cls}"${n === step ? ' aria-current="step"' : ''}><span class="step-dot">${mark}</span><span class="step-label">${label}</span></li>`;
  }).join('');
}

function renderWizard() {
  let w = state.wizard;
  if (w.node === 'result') return renderWizardResults();

  let node = WIZARD_NODES[w.node];
  let step = w.picks.length + 1;
  let firstPick = w.picks[0] ? WIZARD_NODES.start.options[w.picks[0].index] : null;
  let stepName = step === 1 ? 'Симптом' : (firstPick?.label || 'Уточнення');
  let isLast = node.options.every((opt) => opt.next === 'result');

  $('wizardEyebrow').textContent = 'Діагностика / Покроковий помічник';
  $('wizardTitle').textContent = 'Розберімося крок за кроком';
  $('wizardLede').textContent = 'Відповідайте на короткі запитання про те, як поводиться ваш ПК.';
  $('wizardTime').classList.remove('hidden');
  renderStepper(step);

  $('wizardMain').innerHTML = `
    <article class="card wizard-card">
      <p class="eyebrow-mono">Крок ${pad2(step)} / 03 · ${escapeHtml(stepName)}</p>
      <h3>${escapeHtml(node.title)}</h3>
      <p class="muted">${escapeHtml(node.hint)}</p>
      <div class="option-list" role="radiogroup" aria-label="${escapeHtml(node.title)}">
        ${node.options.map((opt, i) => {
          let on = w.selected === i;
          return `<button type="button" class="option${on ? ' is-selected' : ''}" role="radio" aria-checked="${on}" data-opt="${i}">
            <span class="radio" aria-hidden="true">${on ? icon('check', 12) : ''}</span>
            <span><strong>${escapeHtml(opt.text)}</strong><small>${escapeHtml(opt.desc || '')}</small></span>
          </button>`;
        }).join('')}
      </div>
      <p class="note">${escapeHtml(node.note || WIZARD_NOTE)}</p>
      <div class="wizard-actions">
        <button class="btn btn-light" type="button" data-wiz="back"${w.picks.length ? '' : ' disabled'}>${icon('arrow-left', 16)} Назад</button>
        <button class="btn btn-primary" type="button" data-wiz="next"${w.selected === null ? ' disabled' : ''}>${isLast ? 'Переглянути результат' : 'Далі'} ${icon('arrow-right', 16)}</button>
      </div>
    </article>`;

  let answer = wizardPickedOptions()[0];
  $('wizardAside').innerHTML = `
    <section class="card aside-card">
      <h3 class="aside-title">${icon('clipboard', 18)} Ваші відповіді</h3>
      ${answer ? `
        <p class="eyebrow-mono">01 · Прояв несправності</p>
        <p class="aside-answer">${escapeHtml(answer.text)}</p>
        <p class="muted small">${escapeHtml(answer.desc || '')}</p>
        <button class="link-btn" type="button" data-wiz="first">Змінити симптом</button>`
      : `<p class="muted small">Тут з’являться ваші відповіді. Оберіть варіант, який найбільше схожий на поведінку ПК.</p>`}
      <hr />
      <h4>Як працює помічник</h4>
      <p class="muted small">Ви описуєте ознаки, а система зіставляє їх із навчальною базою знань. Доступу до вашого ПК не потрібно.</p>
    </section>
    <div class="notice notice-warn">
      ${icon('alert', 18)}
      <div><strong>Лише безпечні перевірки</strong><p>Якщо відчуваєте запах гару або бачите пошкодження — вимкніть ПК і зверніться до фахівця.</p></div>
    </div>
    <button class="link-btn link-muted" type="button" data-wiz="reset">Скинути відповіді та почати заново</button>`;
}

function renderWizardResults() {
  let picks = wizardPickedOptions();
  let tags = wizardTags();

  let scored = state.faults.map((item) => {
    let hit = (item.tags || []).filter((t) => tags.includes(t)).length;
    let total = Math.max((item.tags || []).length, 1);
    return { item, hit, score: hit / total };
  }).filter((x) => x.hit > 0)
    .sort((a, b) => b.score - a.score || SEVERITY_RANK[b.item.severity] - SEVERITY_RANK[a.item.severity]);

  let [main, ...rest] = scored.slice(0, 4);

  $('wizardEyebrow').textContent = 'Діагностика / Результат';
  $('wizardTitle').textContent = main ? 'Можливу причину знайдено' : 'Не вдалося однозначно зіставити симптоми';
  $('wizardLede').textContent = main
    ? 'Це попередній висновок за вашими відповідями, а не апаратний тест.'
    : 'Спробуйте інший сценарій або перегляньте каталог вручну.';
  $('wizardTime').classList.add('hidden');
  renderStepper(3);

  let actions = `
    <div class="result-actions">
      <button class="btn btn-primary" type="button" data-wiz="reset">${icon('refresh', 16)} Почати нову діагностику</button>
      <button class="btn btn-light" type="button" data-goto="catalog">${icon('grid', 16)} До каталогу</button>
    </div>`;

  if (!main) {
    $('wizardMain').innerHTML = actions;
  } else {
    let { item, score } = main;
    let pct = Math.round(score * 100);
    $('wizardMain').innerHTML = `
      <article class="card result-main">
        <div class="result-top">
          <span class="cat-label">${icon(categoryIcon(item.category), 18)} ${escapeHtml(item.category)}</span>
          ${sevBadge(item.severity)}
        </div>
        <h3 class="result-title">${escapeHtml(item.symptom)}</h3>
        <p class="muted">${escapeHtml(item.cause)}</p>
        <p class="meta-mono">${escapeHtml(faultCode(item))} · Попередній висновок · ${item.steps.length} ${plural(item.steps.length, ['крок', 'кроки', 'кроків'])} перевірки · збіг ${pct}%</p>
      </article>

      <div class="notice notice-warn">
        ${icon('alert', 18)}
        <div><strong>Безпека — передусім</strong><p>Перед будь-якими апаратними перевірками вимкніть ПК та від’єднайте живлення. Ніколи не розбирайте блок живлення. Якщо не маєте досвіду — зверніться до фахівця.</p></div>
      </div>

      <section class="card steps-card">
        <h3>Рекомендовані кроки усунення</h3>
        <ol class="step-list">
          ${item.steps.map((s, i) => `<li><span class="step-num">${pad2(i + 1)}</span><span>${escapeHtml(s)}</span></li>`).join('')}
        </ol>
      </section>

      ${rest.length ? `
      <section class="card other-card">
        <h3>Інші ймовірні причини</h3>
        <ul class="other-list">
          ${rest.map(({ item: it, score: sc }) => `
            <li>
              <div><strong>${escapeHtml(it.symptom)}</strong><small>${escapeHtml(it.category)} · збіг ${Math.round(sc * 100)}%</small></div>
              <button class="btn btn-light btn-sm" type="button" data-open="${escapeHtml(it.id)}">Детальніше</button>
            </li>`).join('')}
        </ul>
      </section>` : ''}

      ${actions}`;
  }

  $('wizardAside').innerHTML = `
    <section class="card aside-card">
      <h3 class="aside-title">Ваш сценарій</h3>
      <dl class="scenario">
        <dt>Симптом</dt><dd>${escapeHtml(picks[0]?.text || '—')}</dd>
        <dt>Уточнення</dt><dd>${escapeHtml(picks[1]?.text || '—')}</dd>
      </dl>
      <button class="link-btn" type="button" data-wiz="back">Повернутися до відповідей</button>
    </section>
    <section class="dark-card">
      ${icon('wrench', 22)}
      <h3>Проблема залишилася?</h3>
      <p>Припиніть самостійні перевірки. Передайте фахівцеві модель плати, опис симптомів і перелік виконаних кроків.</p>
      <p>Запах гару або пошкодження — привід негайно від’єднати живлення.</p>
    </section>`;
}

function selectWizardOption(index) {
  state.wizard.selected = index;
  renderWizard();
  $('wizardMain').querySelector('.option.is-selected')?.focus();
}

function wizardNext() {
  let w = state.wizard;
  if (w.node === 'result' || w.selected === null) return;
  let opt = WIZARD_NODES[w.node].options[w.selected];
  w.picks.push({ nodeId: w.node, index: w.selected });
  w.node = opt.next;
  w.selected = null;
  renderWizard();
}

function wizardBack() {
  let w = state.wizard;
  if (!w.picks.length) return;
  let last = w.picks.pop();
  w.node = last.nodeId;
  w.selected = last.index; // повертаємо попередній вибір
  renderWizard();
}

function wizardToStart() {
  let w = state.wizard;
  let first = w.picks[0];
  state.wizard = { node: 'start', picks: [], selected: first ? first.index : null };
  renderWizard();
}

function resetWizard() {
  state.wizard = { node: 'start', picks: [], selected: null };
  renderWizard();
}

/* ---------- Ролі ---------- */

function applyRole() {
  let isAdmin = state.role === 'admin';
  $('roleGuestBtn').classList.toggle('is-active', !isAdmin);
  $('roleGuestBtn').setAttribute('aria-pressed', String(!isAdmin));
  $('roleAdminBtn').classList.toggle('is-active', isAdmin);
  $('roleAdminBtn').setAttribute('aria-pressed', String(isAdmin));
  $('adminLocked').classList.toggle('hidden', isAdmin);
  $('adminContent').classList.toggle('hidden', !isAdmin);
  $('adminLogoutBtn').classList.toggle('hidden', !isAdmin);
  localStorage.setItem(STORAGE.role, state.role);
  if (!isAdmin && state.admin.editingId) resetFormMode(false);
  if (isAdmin) renderAdminList();
}

/* ---------- Адмін-панель ---------- */

function adminFiltered() {
  let q = state.admin.query.trim().toLowerCase();
  if (!q) return state.faults;
  return state.faults.filter((item) =>
    `${item.symptom} ${item.category} ${faultCode(item)}`.toLowerCase().includes(q));
}

function renderAdminList() {
  let list = adminFiltered();
  let total = list.length;
  let pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  state.admin.page = Math.min(Math.max(1, state.admin.page), pages);
  let from = (state.admin.page - 1) * ADMIN_PAGE_SIZE;
  let slice = list.slice(from, from + ADMIN_PAGE_SIZE);

  $('adminList').innerHTML = slice.map((item) => {
    let id = escapeHtml(item.id);
    let editing = item.id === state.admin.editingId ? ' class="is-editing"' : '';
    return `
    <tr${editing}>
      <td class="cell-code">${escapeHtml(faultCode(item))}</td>
      <td class="cell-title">
        <strong>${escapeHtml(item.symptom)}</strong>
        <small>${escapeHtml(item.category)}</small>
      </td>
      <td class="cell-sev">${sevBadge(item.severity)}</td>
      <td class="cell-actions">
        <button class="row-btn" type="button" data-edit="${id}" aria-label="Редагувати: ${escapeHtml(item.symptom)}">${icon('edit', 14)} Редагувати</button>
        <button class="row-btn is-danger" type="button" data-del="${id}" aria-label="Видалити: ${escapeHtml(item.symptom)}">${icon('trash', 14)} Видалити</button>
      </td>
    </tr>`;
  }).join('');

  $('adminCount').textContent = `${state.faults.length} ${plural(state.faults.length, RECORD_FORMS)} у навчальній базі`;
  $('adminEmpty').classList.toggle('hidden', total > 0);
  $('adminTableWrap').classList.toggle('hidden', total === 0);
  $('adminRange').textContent = total
    ? `Показано ${from + 1}–${from + slice.length} із ${total}`
    : 'Показано 0 із 0';
  $('adminPage').textContent = `Сторінка ${state.admin.page} з ${pages}`;
  $('adminPrev').disabled = state.admin.page <= 1;
  $('adminNext').disabled = state.admin.page >= pages;
}

/** Рядки з textarea → масив кроків без ручної нумерації. */
function parseSteps(text) {
  return text
    .split('\n')
    .map((line) => line.trim().replace(/^(\d+[.)]|[-•*])\s*/, ''))
    .filter(Boolean);
}

function validateForm() {
  let symptom = $('formSymptom').value.trim();
  let cause = $('formCause').value.trim();
  let steps = parseSteps($('formSteps').value);
  if (symptom.length < 8) return 'Симптом має містити щонайменше 8 символів.';
  if (cause.length < 12) return 'Опишіть причину детальніше (від 12 символів).';
  if (steps.length < 2) return 'Додайте щонайменше два кроки усунення.';
  return null;
}

/** Повертає форму в режим «новий запис». */
function resetFormMode(rerender = true) {
  state.admin.editingId = null;
  $('faultForm').reset();
  $('formSeverity').value = 'medium';
  $('formError').textContent = '';
  $('formTitle').textContent = 'Додати несправність';
  $('formModeChip').textContent = 'Чернетка';
  $('formModeChip').classList.remove('is-edit');
  $('formPanel').classList.remove('is-editing');
  $('formSubmitBtn').textContent = 'Додати запис';
  $('formClearBtn').textContent = 'Очистити';
  if (rerender) renderAdminList();
}

function startEdit(id) {
  let item = state.faults.find((f) => f.id === id);
  if (!item) return;
  state.admin.editingId = id;
  $('formCategory').value = item.category;
  $('formSymptom').value = item.symptom;
  $('formCause').value = item.cause;
  $('formSteps').value = item.steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  $('formSeverity').value = item.severity;
  $('formError').textContent = '';
  $('formTitle').textContent = 'Редагувати несправність';
  $('formModeChip').textContent = `Редагування · ${faultCode(item)}`;
  $('formModeChip').classList.add('is-edit');
  $('formPanel').classList.add('is-editing');
  $('formSubmitBtn').textContent = 'Зберегти зміни';
  $('formClearBtn').textContent = 'Скасувати';
  renderAdminList();
  $('formPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  $('formSymptom').focus({ preventScroll: true });
}

function saveFault(event) {
  event.preventDefault();
  let error = validateForm();
  $('formError').textContent = error || '';
  if (error) return;

  let fields = {
    category: $('formCategory').value,
    symptom: $('formSymptom').value.trim(),
    severity: $('formSeverity').value,
    cause: $('formCause').value.trim(),
    steps: parseSteps($('formSteps').value),
  };

  let idx = state.admin.editingId
    ? state.faults.findIndex((f) => f.id === state.admin.editingId)
    : -1;

  if (idx >= 0) {
    // id і tags зберігаємо, щоб не порушити логіку майстра діагностики
    state.faults[idx] = { ...state.faults[idx], ...fields };
    toast('Зміни збережено в localStorage.');
  } else {
    state.faults.unshift({ id: `custom-${Date.now()}`, ...fields, tags: ['custom'] });
    state.admin.page = 1;
    toast('Запис додано і збережено в localStorage.');
  }

  saveFaults();
  resetFormMode();
  renderCatalog();
}

/** Власне модальне підтвердження замість window.confirm. */
function askConfirm({ title, text, okLabel }) {
  return new Promise((resolve) => {
    let dialog = $('confirmModal');
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    $('confirmOkBtn').textContent = okLabel;
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
    dialog.showModal();
  });
}

async function deleteFault(id) {
  let item = state.faults.find((f) => f.id === id);
  if (!item) return;
  let ok = await askConfirm({
    title: 'Видалити запис?',
    text: `«${item.symptom}» буде прибрано з каталогу та сценаріїв помічника. Дію не можна скасувати.`,
    okLabel: 'Видалити',
  });
  if (!ok) return;

  state.faults = state.faults.filter((f) => f.id !== id);
  saveFaults();
  if (state.admin.editingId === id) resetFormMode(false);
  renderAdminList();
  renderCatalog();
  toast('Запис видалено.');
}

async function resetDatabase() {
  let ok = await askConfirm({
    title: 'Відновити початкову базу?',
    text: 'Користувацькі записи та всі внесені зміни буде втрачено.',
    okLabel: 'Відновити',
  });
  if (!ok) return;

  state.faults = cloneData(DEFAULT_FAULTS);
  state.admin.query = '';
  state.admin.page = 1;
  $('adminSearch').value = '';
  saveFaults();
  resetFormMode(false);
  renderAdminList();
  renderCatalog();
  toast('Базу повернуто до початкового стану.');
}

/* ---------- Навігація, модалки, утиліти ---------- */

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === view);
  });
  ['catalog', 'wizard', 'admin'].forEach((name) => {
    let el = $(`view-${name}`);
    let show = name === view;
    el.classList.toggle('is-visible', show);
    el.hidden = !show;
  });
  if (view === 'wizard') renderWizard();
  if (view === 'admin') applyRole();
  window.scrollTo({ top: 0 });
}

function openDetails(id) {
  let item = state.faults.find((f) => f.id === id);
  if (!item) return;
  $('detailBody').innerHTML = `
    <div class="detail-top">
      <span class="cat-label">${icon(categoryIcon(item.category), 18)} ${escapeHtml(item.category)}</span>
      ${sevBadge(item.severity)}
    </div>
    <h3>${escapeHtml(item.symptom)}</h3>
    <p class="meta-mono">${escapeHtml(faultCode(item))}</p>
    <p class="muted">${escapeHtml(item.cause)}</p>
    <h4>Інструкція з усунення</h4>
    <ol class="step-list">
      ${item.steps.map((s, i) => `<li><span class="step-num">${pad2(i + 1)}</span><span>${escapeHtml(s)}</span></li>`).join('')}
    </ol>
    <div class="notice notice-warn">
      ${icon('alert', 18)}
      <div><strong>Безпека — передусім</strong><p>Перед апаратними перевірками вимкніть ПК та від’єднайте живлення.</p></div>
    </div>`;
  $('detailModal').showModal();
}

function toast(message) {
  let el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  $('toasts').append(el);
  setTimeout(() => el.remove(), 2800);
}

function openLogin() {
  $('loginError').textContent = '';
  $('loginPass').value = '';
  $('loginModal').showModal();
  $('loginName').focus();
}

function tryLogin(event) {
  event.preventDefault();
  let name = $('loginName').value.trim();
  let pass = $('loginPass').value;
  if (name === ADMIN_LOGIN.name && pass === ADMIN_LOGIN.password) {
    state.role = 'admin';
    applyRole();
    $('loginError').textContent = '';
    $('loginForm').reset();
    $('loginModal').close();
    setView('admin');
    toast('Вхід виконано. Доступна панель адміністратора.');
    return;
  }
  $('loginError').textContent = 'Невірний логін або пароль.';
}

function logout() {
  state.role = 'guest';
  applyRole();
  toast('Режим гостя. Панель адміністратора заблоковано.');
}

function bindEvents() {
  // Навігація
  document.querySelector('.main-nav').addEventListener('click', (e) => {
    let btn = e.target.closest('[data-view]');
    if (btn) setView(btn.dataset.view);
  });
  document.addEventListener('click', (e) => {
    let target = e.target.closest('[data-goto]')?.dataset.goto;
    if (target) setView(target);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setView('catalog');
      $('searchInput').focus();
    }
  });

  // Каталог
  $('searchInput').addEventListener('input', (e) => {
    state.query = e.target.value;
    renderCatalog();
  });
  $('sortSelect').addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderCatalog();
  });
  $('categoryPills').addEventListener('click', (e) => {
    let cat = e.target.closest('[data-cat]')?.dataset.cat;
    if (cat === undefined) return;
    state.category = cat;
    renderCatalog();
  });
  $('catalogGrid').addEventListener('click', (e) => {
    let id = e.target.closest('[data-open]')?.dataset.open;
    if (id) openDetails(id);
  });

  // Майстер
  $('view-wizard').addEventListener('click', (e) => {
    let opt = e.target.closest('[data-opt]');
    if (opt) return selectWizardOption(Number(opt.dataset.opt));
    let act = e.target.closest('[data-wiz]')?.dataset.wiz;
    if (act === 'next') return wizardNext();
    if (act === 'back') return wizardBack();
    if (act === 'first') return wizardToStart();
    if (act === 'reset') return resetWizard();
    let id = e.target.closest('[data-open]')?.dataset.open;
    if (id) openDetails(id);
  });

  // Ролі та вхід
  $('roleGuestBtn').addEventListener('click', () => {
    if (state.role === 'admin') logout();
  });
  $('roleAdminBtn').addEventListener('click', () => {
    if (state.role !== 'admin') openLogin();
  });
  $('adminLoginBtn').addEventListener('click', openLogin);
  $('adminLogoutBtn').addEventListener('click', logout);
  $('loginCancelBtn').addEventListener('click', () => $('loginModal').close());
  $('loginForm').addEventListener('submit', tryLogin);
  $('detailCloseBtn').addEventListener('click', () => $('detailModal').close());
  $('detailModal').addEventListener('click', (e) => {
    if (e.target === $('detailModal')) $('detailModal').close();
  });

  // CRUD в адмін-панелі
  $('faultForm').addEventListener('submit', saveFault);
  $('formClearBtn').addEventListener('click', () => resetFormMode());
  $('adminList').addEventListener('click', (e) => {
    let editId = e.target.closest('[data-edit]')?.dataset.edit;
    if (editId) return startEdit(editId);
    let delId = e.target.closest('[data-del]')?.dataset.del;
    if (delId) deleteFault(delId);
  });
  $('adminSearch').addEventListener('input', (e) => {
    state.admin.query = e.target.value;
    state.admin.page = 1;
    renderAdminList();
  });
  $('adminPrev').addEventListener('click', () => {
    state.admin.page -= 1;
    renderAdminList();
  });
  $('adminNext').addEventListener('click', () => {
    state.admin.page += 1;
    renderAdminList();
  });
  $('resetDbBtn').addEventListener('click', resetDatabase);
}

function init() {
  state.faults = loadFaults();
  state.role = loadRole();
  hydrateIcons();
  fillSelects();
  bindEvents();
  applyRole();
  renderCatalog();
  renderWizard();
}

document.addEventListener('DOMContentLoaded', init);
