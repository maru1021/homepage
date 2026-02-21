/**
 * DKCドライブ - 定数定義
 */

export const BORDER_STYLE = '1px solid #000';
export const DEFAULT_BORDER = '1px solid #e0e0e0';
export const BORDER_CONFIG = { style: 'thin', color: '#000000' };

// フォントサイズ
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
export const DEFAULT_FONT_SIZE = 12;

export const FILE_TYPES = {
    EXCEL: 'excel',
    CSV: 'csv',
    POWERPOINT: 'powerpoint',
    IMAGE: 'image',
    MODEL3D: 'model3d',
    PDF: 'pdf',
    VIDEO: 'video',
    AUDIO: 'audio',
    TEXT: 'text',
    HTML: 'html',
    MSG: 'msg',
    OTHER: 'other'
};

/** スプレッドシートとして扱うファイルタイプか判定 */
export const isSpreadsheetType = (fileType) =>
    fileType === FILE_TYPES.EXCEL || fileType === FILE_TYPES.CSV;

// スプレッドシートのレイアウト定数
export const SPREADSHEET = {
    DEFAULT_ROWS: 50,
    DEFAULT_COLS: 26,
    DEFAULT_COL_WIDTH: 80,
    DEFAULT_ROW_HEIGHT: 24,
    MIN_COL_WIDTH: 30,
    MIN_ROW_HEIGHT: 18,
    ROW_HEADER_WIDTH: 40,
    COL_HEADER_HEIGHT: 24,
    INITIAL_RENDER_ROWS: 50,
};

// 自動スクロール設定
export const AUTO_SCROLL = {
    EDGE_THRESHOLD: 50,
    SCROLL_SPEED: 15,
    OUTSIDE_MULTIPLIER: 2,
    INTERVAL_MS: 30,
};

// スクロール拡張設定
export const SCROLL_EXPAND = {
    THRESHOLD: 200,
    DATA_BATCH_ROWS: 50,
    DATA_BATCH_COLS: 20,
    EMPTY_BATCH: 10,
    GRID_EDGE_THRESHOLD: 3,
};

// APIエンドポイント
const BASE = '/drive/api';
export const API = {
    LIST:            `${BASE}/list/`,
    UPLOAD:          `${BASE}/upload/`,
    UPLOAD_FOLDER:   `${BASE}/upload-folder/`,
    CREATE:          `${BASE}/create/`,
    FOLDER:          `${BASE}/folder/`,
    DATA:            `${BASE}/data/`,
    RENAME:          `${BASE}/rename/`,
    DELETE:          `${BASE}/delete/`,
    MOVE:            `${BASE}/move/`,
    DOWNLOAD:        `${BASE}/download/`,
    SAVE:            `${BASE}/save/`,
    COLUMN_WIDTH:    `${BASE}/column-width/`,
    ROW_HEIGHT:      `${BASE}/row-height/`,
    AUTO_FILTER:     `${BASE}/auto-filter/`,
    ADD_SHEET:       `${BASE}/add-sheet/`,
    DELETE_SHEET:    `${BASE}/delete-sheet/`,
    RENAME_SHEET:    `${BASE}/rename-sheet/`,
    IMAGE:           `${BASE}/spreadsheet/image/`,
    IMAGE_DELETE:    `${BASE}/spreadsheet/image/delete/`,
    IMAGE_DATA:      `${BASE}/spreadsheet/image-data/`,
    MERGE_CELLS:     `${BASE}/merge-cells/`,
    UNMERGE_CELLS:   `${BASE}/unmerge-cells/`,
    SHAPE:           `${BASE}/spreadsheet/shape/`,
    SHAPE_DELETE:    `${BASE}/spreadsheet/shape/delete/`,
    CHART:           `${BASE}/spreadsheet/chart/`,
    CHART_DELETE:    `${BASE}/spreadsheet/chart/delete/`,
    FOLDER_ANALYSIS: `${BASE}/folder-analysis/`,
    FOLDER_ANALYSIS_DATA: `${BASE}/folder-analysis-data/`,
    SAVE_CHART:      `${BASE}/save-chart/`,
    SAVE_HTML:       `${BASE}/save-html/`,
    SERVE:           `${BASE}/serve/`,
    CAD:             `${BASE}/cad/`,
    PPT:             `${BASE}/ppt/`,
    TEXT:            `${BASE}/text/`,
    MSG:             `${BASE}/msg/`,
    IMAGE_ANALYSIS:  `${BASE}/image-analysis/`,
};

// ファイルマネージャ設定
export const FILE_MANAGER = {
    PAGE_SIZE: 50,
};

export const FILE_TYPE_MAP = {
    xlsx: FILE_TYPES.EXCEL, xls: FILE_TYPES.EXCEL,
    csv: FILE_TYPES.CSV,
    pptx: FILE_TYPES.POWERPOINT, ppt: FILE_TYPES.POWERPOINT,
    jpg: FILE_TYPES.IMAGE, jpeg: FILE_TYPES.IMAGE, png: FILE_TYPES.IMAGE,
    gif: FILE_TYPES.IMAGE, bmp: FILE_TYPES.IMAGE, webp: FILE_TYPES.IMAGE, svg: FILE_TYPES.IMAGE,
    stl: FILE_TYPES.MODEL3D, obj: FILE_TYPES.MODEL3D, gltf: FILE_TYPES.MODEL3D, glb: FILE_TYPES.MODEL3D,
    stp: FILE_TYPES.MODEL3D, step: FILE_TYPES.MODEL3D,
    pdf: FILE_TYPES.PDF,
    mp4: FILE_TYPES.VIDEO, webm: FILE_TYPES.VIDEO, mov: FILE_TYPES.VIDEO,
    mp3: FILE_TYPES.AUDIO, wav: FILE_TYPES.AUDIO, ogg: FILE_TYPES.AUDIO,
    txt: FILE_TYPES.TEXT, log: FILE_TYPES.TEXT, md: FILE_TYPES.TEXT, json: FILE_TYPES.TEXT,
    xml: FILE_TYPES.TEXT, yaml: FILE_TYPES.TEXT, yml: FILE_TYPES.TEXT,
    js: FILE_TYPES.TEXT, py: FILE_TYPES.TEXT, css: FILE_TYPES.TEXT,
    html: FILE_TYPES.HTML, htm: FILE_TYPES.HTML,
    msg: FILE_TYPES.MSG
};

// 図形タイプ
export const SHAPE_TYPES = {
    RECTANGLE: 'rectangle',
    ROUNDED_RECTANGLE: 'rounded_rectangle',
    ELLIPSE: 'ellipse',
    TRIANGLE: 'triangle',
    LINE: 'line',
    ARROW: 'arrow',
};

// 図形デフォルト値
export const SHAPE_DEFAULTS = {
    width: 120,
    height: 80,
    fillColor: '#4285f4',
    strokeColor: '#333333',
    strokeWidth: 2,
    opacity: 1.0,
};
