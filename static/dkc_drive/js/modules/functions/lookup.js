/**
 * DKCドライブ - 検索関数
 * INDEX, MATCH, HLOOKUP
 */

import { parseRangeRef, getCellValue, toNumber, isErrorValue } from './parser.js';

/**
 * INDEX関数: 範囲から指定位置の値を返す
 * @param {Array} args - 評価済み引数 [範囲, 行番号, [列番号]]
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {*} 指定位置の値またはエラー
 *
 * 使用例:
 * =INDEX(A1:C10, 3, 2)   - A1:C10の3行目2列目の値
 * =INDEX(A1:A10, 5)      - A1:A10の5番目の値
 */
export function index(args, rawArgs, context) {
    if (args.length < 2 || rawArgs.length < 1) {
        return '#VALUE!';
    }

    const rangeArg = rawArgs[0];
    if (rangeArg.type !== 'RANGE') {
        return '#VALUE!';
    }

    const range = parseRangeRef(rangeArg.value);
    if (!range) {
        return '#REF!';
    }

    const rowNum = toNumber(args[1]);
    if (rowNum === null || rowNum < 0) {
        return '#VALUE!';
    }

    const colNum = args.length >= 3 ? toNumber(args[2]) : 1;
    if (colNum === null || colNum < 0) {
        return '#VALUE!';
    }

    const { start, end } = range;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const rowCount = maxRow - minRow + 1;
    const colCount = maxCol - minCol + 1;

    // 行番号が0の場合は列全体、列番号が0の場合は行全体を返す（配列として）
    // 現在の実装では単一値のみサポート
    if (rowNum === 0 || colNum === 0) {
        return '#VALUE!';
    }

    // 範囲外チェック
    if (rowNum > rowCount || colNum > colCount) {
        return '#REF!';
    }

    const targetRow = minRow + rowNum - 1;
    const targetCol = minCol + colNum - 1;

    const value = getCellValue(
        context.cells,
        targetRow,
        targetCol,
        context.evaluateFormula,
        context.visitedCells
    );

    return value ?? '';
}

/**
 * MATCH関数: 検索値の位置を返す
 * @param {Array} args - 評価済み引数 [検索値, 範囲, [照合の型]]
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number|string} 位置またはエラー
 *
 * 使用例:
 * =MATCH("りんご", A1:A10, 0)   - "りんご"の位置（完全一致）
 * =MATCH(100, B1:B10, 1)        - 100以下の最大値の位置（昇順）
 * =MATCH(100, B1:B10, -1)       - 100以上の最小値の位置（降順）
 *
 * 照合の型:
 *  1 または省略: 検索値以下の最大値（昇順に並んでいることが前提）
 *  0: 完全一致
 * -1: 検索値以上の最小値（降順に並んでいることが前提）
 */
export function match(args, rawArgs, context) {
    if (args.length < 2 || rawArgs.length < 2) {
        return '#VALUE!';
    }

    const searchValue = args[0];
    const rangeArg = rawArgs[1];
    const matchType = args.length >= 3 ? toNumber(args[2]) : 1;

    if (isErrorValue(searchValue)) {
        return searchValue;
    }

    if (rangeArg.type !== 'RANGE') {
        return '#VALUE!';
    }

    const range = parseRangeRef(rangeArg.value);
    if (!range) {
        return '#REF!';
    }

    const { start, end } = range;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    // 1行または1列の範囲のみサポート
    const isRow = minRow === maxRow;
    const isCol = minCol === maxCol;

    if (!isRow && !isCol) {
        // 複数行・複数列の場合は最初の列を使用
    }

    const values = [];
    if (isRow) {
        // 横方向
        for (let col = minCol; col <= maxCol; col++) {
            const value = getCellValue(
                context.cells,
                minRow,
                col,
                context.evaluateFormula,
                context.visitedCells
            );
            values.push(value);
        }
    } else {
        // 縦方向
        for (let row = minRow; row <= maxRow; row++) {
            const value = getCellValue(
                context.cells,
                row,
                minCol,
                context.evaluateFormula,
                context.visitedCells
            );
            values.push(value);
        }
    }

    const searchNum = toNumber(searchValue);

    // 完全一致 (matchType = 0)
    if (matchType === 0) {
        for (let i = 0; i < values.length; i++) {
            if (valuesMatch(values[i], searchValue)) {
                return i + 1;
            }
        }
        return '#N/A';
    }

    // 近似一致 (matchType = 1 または -1)
    let matchIndex = -1;
    let matchValue = null;

    for (let i = 0; i < values.length; i++) {
        const cellValue = values[i];

        if (cellValue === null || cellValue === '') {
            continue;
        }

        if (matchType >= 1) {
            // 昇順：検索値以下の最大値
            if (searchNum !== null) {
                const cellNum = toNumber(cellValue);
                if (cellNum !== null && cellNum <= searchNum) {
                    if (matchValue === null || cellNum > matchValue) {
                        matchIndex = i;
                        matchValue = cellNum;
                    }
                }
            } else {
                const searchStr = String(searchValue).toLowerCase();
                const cellStr = String(cellValue).toLowerCase();
                if (cellStr <= searchStr) {
                    if (matchValue === null || cellStr > matchValue) {
                        matchIndex = i;
                        matchValue = cellStr;
                    }
                }
            }
        } else {
            // 降順：検索値以上の最小値
            if (searchNum !== null) {
                const cellNum = toNumber(cellValue);
                if (cellNum !== null && cellNum >= searchNum) {
                    if (matchValue === null || cellNum < matchValue) {
                        matchIndex = i;
                        matchValue = cellNum;
                    }
                }
            } else {
                const searchStr = String(searchValue).toLowerCase();
                const cellStr = String(cellValue).toLowerCase();
                if (cellStr >= searchStr) {
                    if (matchValue === null || cellStr < matchValue) {
                        matchIndex = i;
                        matchValue = cellStr;
                    }
                }
            }
        }
    }

    if (matchIndex === -1) {
        return '#N/A';
    }

    return matchIndex + 1;
}

/**
 * HLOOKUP関数: 横方向の検索を行い、指定した行の値を返す
 * @param {Array} args - 評価済み引数 [検索値, 範囲, 行番号, [近似一致]]
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {*} 検索結果の値またはエラー
 *
 * 使用例:
 * =HLOOKUP("りんご", A1:E3, 2, FALSE)   - 1行目で"りんご"を検索し、2行目の値を返す
 */
export function hlookup(args, rawArgs, context) {
    if (args.length < 3 || rawArgs.length < 2) {
        return '#VALUE!';
    }

    const searchValue = args[0];
    const rangeArg = rawArgs[1];
    const rowIndex = toNumber(args[2]);
    const exactMatch = args.length >= 4 ? !isTruthy(args[3]) : false;

    if (isErrorValue(searchValue)) {
        return searchValue;
    }

    if (rowIndex === null || rowIndex < 1) {
        return '#VALUE!';
    }

    if (rangeArg.type !== 'RANGE') {
        return '#VALUE!';
    }

    const range = parseRangeRef(rangeArg.value);
    if (!range) {
        return '#REF!';
    }

    const { start, end } = range;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const rowCount = maxRow - minRow + 1;
    if (rowIndex > rowCount) {
        return '#REF!';
    }

    const searchRow = minRow;
    const resultRow = minRow + rowIndex - 1;

    // 完全一致検索
    if (exactMatch) {
        for (let col = minCol; col <= maxCol; col++) {
            const cellValue = getCellValue(
                context.cells,
                searchRow,
                col,
                context.evaluateFormula,
                context.visitedCells
            );

            if (valuesMatch(cellValue, searchValue)) {
                const result = getCellValue(
                    context.cells,
                    resultRow,
                    col,
                    context.evaluateFormula,
                    context.visitedCells
                );
                return result ?? '';
            }
        }
        return '#N/A';
    }

    // 近似一致検索
    let matchCol = -1;
    let matchValue = null;
    const searchNum = toNumber(searchValue);

    for (let col = minCol; col <= maxCol; col++) {
        const cellValue = getCellValue(
            context.cells,
            searchRow,
            col,
            context.evaluateFormula,
            context.visitedCells
        );

        if (cellValue === null || cellValue === '') {
            continue;
        }

        if (searchNum !== null) {
            const cellNum = toNumber(cellValue);
            if (cellNum !== null && cellNum <= searchNum) {
                if (matchValue === null || cellNum > matchValue) {
                    matchCol = col;
                    matchValue = cellNum;
                }
            }
        } else {
            const searchStr = String(searchValue).toLowerCase();
            const cellStr = String(cellValue).toLowerCase();
            if (cellStr <= searchStr) {
                if (matchValue === null || cellStr > matchValue) {
                    matchCol = col;
                    matchValue = cellStr;
                }
            }
        }
    }

    if (matchCol === -1) {
        return '#N/A';
    }

    const result = getCellValue(
        context.cells,
        resultRow,
        matchCol,
        context.evaluateFormula,
        context.visitedCells
    );
    return result ?? '';
}

/**
 * 値が一致するかチェック（大文字小文字を区別しない文字列比較）
 */
function valuesMatch(value1, value2) {
    if ((value1 === null || value1 === '') && (value2 === null || value2 === '')) {
        return true;
    }

    if (value1 === null || value1 === '' || value2 === null || value2 === '') {
        return false;
    }

    const num1 = toNumber(value1);
    const num2 = toNumber(value2);

    if (num1 !== null && num2 !== null) {
        return num1 === num2;
    }

    return String(value1).toLowerCase() === String(value2).toLowerCase();
}

/**
 * 値が真とみなされるかチェック
 */
function isTruthy(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        const upper = value.toUpperCase();
        if (upper === 'TRUE') return true;
        if (upper === 'FALSE') return false;
        const num = parseFloat(value);
        return !isNaN(num) && num !== 0;
    }
    return false;
}
