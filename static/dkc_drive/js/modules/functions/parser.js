/**
 * DKCドライブ - 数式パーサー（最適化版）
 * 高速なトークナイザーとキャッシュ機構
 */

// キャッシュ
const cellRefCache = new Map();
const tokenCache = new Map();
const TOKEN_CACHE_MAX = 500;

// 文字コード定数（高速判定用）
const CHAR_0 = 48, CHAR_9 = 57;
const CHAR_A = 65, CHAR_Z = 90;
const CHAR_a = 97, CHAR_z = 122;
const CHAR_DOT = 46;
const CHAR_QUOTE = 34;
const CHAR_LPAREN = 40, CHAR_RPAREN = 41;
const CHAR_COMMA = 44;
const CHAR_COLON = 58;
const CHAR_DOLLAR = 36;
const CHAR_PLUS = 43, CHAR_MINUS = 45;
const CHAR_STAR = 42, CHAR_SLASH = 47;
const CHAR_CARET = 94, CHAR_PERCENT = 37;
const CHAR_LT = 60, CHAR_GT = 62, CHAR_EQ = 61;
const CHAR_SPACE = 32, CHAR_TAB = 9;

const isDigit = c => c >= CHAR_0 && c <= CHAR_9;
const isAlpha = c => (c >= CHAR_A && c <= CHAR_Z) || (c >= CHAR_a && c <= CHAR_z);
const isAlphaNum = c => isDigit(c) || isAlpha(c);
const isWhitespace = c => c === CHAR_SPACE || c === CHAR_TAB;

/**
 * セル参照（A1形式）を行・列番号に変換（キャッシュ付き）
 */
export function parseCellRef(ref) {
    if (cellRefCache.has(ref)) return cellRefCache.get(ref);

    const len = ref.length;
    let i = 0;
    let col = 0;

    // 列部分（英字）をパース
    while (i < len) {
        const c = ref.charCodeAt(i);
        if (c >= CHAR_A && c <= CHAR_Z) {
            col = col * 26 + (c - CHAR_A + 1);
            i++;
        } else if (c >= CHAR_a && c <= CHAR_z) {
            col = col * 26 + (c - CHAR_a + 1);
            i++;
        } else {
            break;
        }
    }

    if (i === 0 || i === len) {
        cellRefCache.set(ref, null);
        return null;
    }

    // 行部分（数字）をパース
    let row = 0;
    while (i < len) {
        const c = ref.charCodeAt(i);
        if (isDigit(c)) {
            row = row * 10 + (c - CHAR_0);
            i++;
        } else {
            cellRefCache.set(ref, null);
            return null;
        }
    }

    const result = { row: row - 1, col: col - 1 };
    cellRefCache.set(ref, result);
    return result;
}

/**
 * 列名を列インデックスに変換（A=0, B=1, ..., Z=25, AA=26, ...）
 */
export function parseColumnRef(colStr) {
    if (!colStr || !/^[A-Za-z]+$/.test(colStr)) return null;
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
        const c = colStr.charCodeAt(i);
        if (c >= CHAR_A && c <= CHAR_Z) {
            col = col * 26 + (c - CHAR_A + 1);
        } else if (c >= CHAR_a && c <= CHAR_z) {
            col = col * 26 + (c - CHAR_a + 1);
        }
    }
    return col - 1;
}

/**
 * 行番号文字列を行インデックスに変換（1=0, 2=1, ...）
 */
export function parseRowRef(rowStr) {
    if (!rowStr || !/^\d+$/.test(rowStr)) return null;
    const row = parseInt(rowStr, 10);
    return row > 0 ? row - 1 : null;
}

/**
 * 範囲参照（A1:B3, A:A, 1:1形式）をパース
 */
export function parseRangeRef(range) {
    const colonIdx = range.indexOf(':');
    if (colonIdx === -1) return null;

    const leftPart = range.substring(0, colonIdx);
    const rightPart = range.substring(colonIdx + 1);

    // A1:B3 形式（通常のセル範囲）
    const startCell = parseCellRef(leftPart);
    const endCell = parseCellRef(rightPart);
    if (startCell && endCell) {
        return { start: startCell, end: endCell, type: 'cell' };
    }

    // A:B 形式（列全体）
    const startCol = parseColumnRef(leftPart);
    const endCol = parseColumnRef(rightPart);
    if (startCol !== null && endCol !== null) {
        return {
            startCol: Math.min(startCol, endCol),
            endCol: Math.max(startCol, endCol),
            type: 'column'
        };
    }

    // 1:5 形式（行全体）
    const startRow = parseRowRef(leftPart);
    const endRow = parseRowRef(rightPart);
    if (startRow !== null && endRow !== null) {
        return {
            startRow: Math.min(startRow, endRow),
            endRow: Math.max(startRow, endRow),
            type: 'row'
        };
    }

    return null;
}

/**
 * 範囲内のすべてのセル座標を取得
 * @param {string} range - 範囲参照文字列（A1:B3, A:A, 1:1）
 * @param {Object} cells - セルデータ（列/行全体参照時に必要）
 */
export function getCellsInRange(range, cells = null) {
    const parsed = parseRangeRef(range);
    if (!parsed) return [];

    // 通常のセル範囲（A1:B3形式）
    if (parsed.type === 'cell') {
        const { start, end } = parsed;
        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        const minCol = Math.min(start.col, end.col);
        const maxCol = Math.max(start.col, end.col);

        const result = [];
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                result.push({ row: r, col: c });
            }
        }
        return result;
    }

    // 列全体参照（A:A, A:C形式）
    if (parsed.type === 'column') {
        const { startCol, endCol } = parsed;
        const result = [];

        if (cells) {
            // cellsオブジェクトから該当列のセルを抽出
            for (const key of Object.keys(cells)) {
                const [r, c] = key.split(',').map(Number);
                if (c >= startCol && c <= endCol) {
                    result.push({ row: r, col: c });
                }
            }
        }
        return result;
    }

    // 行全体参照（1:1, 1:5形式）
    if (parsed.type === 'row') {
        const { startRow, endRow } = parsed;
        const result = [];

        if (cells) {
            // cellsオブジェクトから該当行のセルを抽出
            for (const key of Object.keys(cells)) {
                const [r, c] = key.split(',').map(Number);
                if (r >= startRow && r <= endRow) {
                    result.push({ row: r, col: c });
                }
            }
        }
        return result;
    }

    return [];
}

/**
 * セルの値を取得（数式計算用）
 */
export function getCellValue(cells, row, col, evaluateFormula, visitedCells = new Set()) {
    const key = `${row},${col}`;
    const cell = cells[key];

    if (!cell || cell.value === undefined || cell.value === null || cell.value === '') {
        return null;
    }

    const value = String(cell.value);

    if (value.charCodeAt(0) === CHAR_EQ) { // '='
        if (visitedCells.has(key)) return '#REF!';
        const newVisited = new Set(visitedCells);
        newVisited.add(key);
        return evaluateFormula(value, cells, newVisited);
    }

    // 数値変換を試みる
    const num = +value;
    if (!isNaN(num) && isFinite(num)) return num;

    return value;
}

/**
 * 範囲内のすべてのセル値を取得
 */
export function getRangeValues(range, cells, evaluateFormula, visitedCells = new Set()) {
    const cellsInRange = getCellsInRange(range, cells);
    return cellsInRange.map(({ row, col }) =>
        getCellValue(cells, row, col, evaluateFormula, visitedCells)
    );
}

/**
 * 値を数値に変換
 */
export function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const num = +value;
        return !isNaN(num) && isFinite(num) ? num : null;
    }
    return null;
}

/**
 * エラー値かどうかを判定
 */
export function isErrorValue(value) {
    if (typeof value !== 'string' || value.length < 2) return false;
    return value.charCodeAt(0) === 35 && value.charCodeAt(value.length - 1) === 33; // '#' and '!'
}

/**
 * 比較演算を実行
 */
export function compare(left, operator, right) {
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);

    if (leftNum !== null && rightNum !== null) {
        switch (operator) {
            case '=': return leftNum === rightNum;
            case '<>': return leftNum !== rightNum;
            case '<': return leftNum < rightNum;
            case '>': return leftNum > rightNum;
            case '<=': return leftNum <= rightNum;
            case '>=': return leftNum >= rightNum;
        }
    }

    const leftStr = String(left ?? '');
    const rightStr = String(right ?? '');

    switch (operator) {
        case '=': return leftStr === rightStr;
        case '<>': return leftStr !== rightStr;
        case '<': return leftStr < rightStr;
        case '>': return leftStr > rightStr;
        case '<=': return leftStr <= rightStr;
        case '>=': return leftStr >= rightStr;
    }
    return false;
}

/**
 * 高速トークナイザー
 */
export function tokenize(formula) {
    // キャッシュチェック
    if (tokenCache.has(formula)) return tokenCache.get(formula);

    const tokens = [];
    const len = formula.length;
    let i = 0;

    while (i < len) {
        const c = formula.charCodeAt(i);

        // 空白をスキップ
        if (isWhitespace(c)) {
            i++;
            continue;
        }

        // 数値または行参照（1:1形式）
        if (isDigit(c) || (c === CHAR_DOT && i + 1 < len && isDigit(formula.charCodeAt(i + 1)))) {
            let start = i;
            while (i < len && (isDigit(formula.charCodeAt(i)) || formula.charCodeAt(i) === CHAR_DOT)) i++;

            // 行参照（1:5形式）かチェック
            if (i < len && formula.charCodeAt(i) === CHAR_COLON) {
                const colonPos = i;
                i++; // コロンをスキップ
                if (i < len && isDigit(formula.charCodeAt(i))) {
                    while (i < len && isDigit(formula.charCodeAt(i))) i++;
                    tokens.push({ type: 'RANGE', value: formula.substring(start, i) });
                    continue;
                }
                // 数値:で終わる場合は数値として処理
                i = colonPos;
            }

            tokens.push({ type: 'NUMBER', value: formula.substring(start, i) });
            continue;
        }

        // 文字列（ダブルクォート）
        if (c === CHAR_QUOTE) {
            let str = '';
            i++;
            while (i < len && formula.charCodeAt(i) !== CHAR_QUOTE) {
                if (formula.charCodeAt(i) === 92 && i + 1 < len) { // backslash
                    str += formula[++i];
                } else {
                    str += formula[i];
                }
                i++;
            }
            i++;
            tokens.push({ type: 'STRING', value: str });
            continue;
        }

        // 識別子（セル参照、関数名）
        if (isAlpha(c)) {
            let start = i;
            while (i < len) {
                const cc = formula.charCodeAt(i);
                if (isAlphaNum(cc) || cc === CHAR_COLON || cc === CHAR_DOLLAR) {
                    i++;
                } else {
                    break;
                }
            }
            const ident = formula.substring(start, i).toUpperCase();

            if (i < len && formula.charCodeAt(i) === CHAR_LPAREN) {
                tokens.push({ type: 'FUNCTION', value: ident });
            } else if (ident.indexOf(':') !== -1) {
                tokens.push({ type: 'RANGE', value: ident });
            } else if (/^[A-Z]+\d+$/.test(ident)) {
                tokens.push({ type: 'CELL', value: ident });
            } else {
                tokens.push({ type: 'IDENT', value: ident });
            }
            continue;
        }

        // 演算子
        if (c === CHAR_PLUS || c === CHAR_MINUS || c === CHAR_STAR ||
            c === CHAR_SLASH || c === CHAR_CARET || c === CHAR_PERCENT) {
            tokens.push({ type: 'OPERATOR', value: formula[i++] });
            continue;
        }

        // 括弧・カンマ
        if (c === CHAR_LPAREN) { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue; }
        if (c === CHAR_RPAREN) { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue; }
        if (c === CHAR_COMMA) { tokens.push({ type: 'COMMA', value: ',' }); i++; continue; }

        // 比較演算子
        if (c === CHAR_LT || c === CHAR_GT || c === CHAR_EQ) {
            let op = formula[i++];
            if (i < len) {
                const next = formula.charCodeAt(i);
                if (next === CHAR_EQ || (c === CHAR_LT && next === CHAR_GT)) {
                    op += formula[i++];
                }
            }
            tokens.push({ type: 'COMPARE', value: op });
            continue;
        }

        i++;
    }

    // キャッシュに保存（サイズ制限）
    if (tokenCache.size >= TOKEN_CACHE_MAX) {
        const firstKey = tokenCache.keys().next().value;
        tokenCache.delete(firstKey);
    }
    tokenCache.set(formula, tokens);

    return tokens;
}

/**
 * キャッシュをクリア
 */
export function clearCache() {
    cellRefCache.clear();
    tokenCache.clear();
}
