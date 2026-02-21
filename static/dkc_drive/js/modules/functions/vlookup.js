/**
 * DKCドライブ - VLOOKUP関数
 * 縦方向の検索を行い、指定した列の値を返す
 */

import { parseRangeRef, getCellValue, toNumber, isErrorValue } from './parser.js';

/**
 * VLOOKUP関数: 範囲の左端列を検索し、一致した行の指定列の値を返す
 * @param {Array} args - 評価済み引数 [検索値, 範囲, 列番号, 検索方法]
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {*} 検索結果の値、見つからない場合は#N/A
 *
 * 使用例:
 * =VLOOKUP(A1,B1:D10,2,FALSE)   - A1の値をB1:D10の左端列から検索し、2列目の値を返す（完全一致）
 * =VLOOKUP("りんご",A1:C5,3,0)  - "りんご"をA1:C5から検索し、3列目の値を返す
 * =VLOOKUP(100,A1:B10,2,TRUE)   - 100以下の最大値を検索し、2列目の値を返す（近似一致）
 * =VLOOKUP(A1,B:D,2,FALSE)      - 列全体を検索範囲として使用
 */
export function vlookup(args, rawArgs, context) {
    // 引数チェック
    if (args.length < 3 || rawArgs.length < 2) {
        return '#VALUE!';
    }

    const searchValue = args[0];
    const rangeArg = rawArgs[1];
    const colIndex = toNumber(args[2]);
    // 第4引数: TRUE(1)/省略 = 近似一致, FALSE(0) = 完全一致
    const exactMatch = args.length >= 4 ? !isTruthy(args[3]) : false;

    // エラーチェック
    if (isErrorValue(searchValue)) {
        return searchValue;
    }

    if (colIndex === null || colIndex < 1) {
        return '#VALUE!';
    }

    if (rangeArg.type !== 'RANGE') {
        return '#VALUE!';
    }

    // 範囲をパース
    const range = parseRangeRef(rangeArg.value);
    if (!range) {
        return '#REF!';
    }

    const { start, end } = range;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    // 列番号が範囲を超えている場合
    const rangeColCount = maxCol - minCol + 1;
    if (colIndex > rangeColCount) {
        return '#REF!';
    }

    const searchCol = minCol; // 検索列（左端）
    const resultCol = minCol + colIndex - 1; // 結果列

    // 完全一致検索
    if (exactMatch) {
        for (let row = minRow; row <= maxRow; row++) {
            const cellValue = getCellValue(
                context.cells,
                row,
                searchCol,
                context.evaluateFormula,
                context.visitedCells
            );

            if (valuesMatch(cellValue, searchValue)) {
                // 一致した行の指定列の値を返す
                const result = getCellValue(
                    context.cells,
                    row,
                    resultCol,
                    context.evaluateFormula,
                    context.visitedCells
                );
                return result ?? '';
            }
        }
        // 見つからない場合
        return '#N/A';
    }

    // 近似一致検索（昇順にソートされていることを前提）
    // 検索値以下の最大値を探す
    let matchRow = -1;
    let matchValue = null;

    const searchNum = toNumber(searchValue);

    for (let row = minRow; row <= maxRow; row++) {
        const cellValue = getCellValue(
            context.cells,
            row,
            searchCol,
            context.evaluateFormula,
            context.visitedCells
        );

        // 空セルはスキップ
        if (cellValue === null || cellValue === '') {
            continue;
        }

        // 数値検索の場合
        if (searchNum !== null) {
            const cellNum = toNumber(cellValue);
            if (cellNum !== null) {
                if (cellNum <= searchNum) {
                    if (matchValue === null || cellNum > matchValue) {
                        matchRow = row;
                        matchValue = cellNum;
                    }
                }
            }
        } else {
            // 文字列検索の場合
            const searchStr = String(searchValue).toLowerCase();
            const cellStr = String(cellValue).toLowerCase();

            if (cellStr <= searchStr) {
                if (matchValue === null || cellStr > matchValue) {
                    matchRow = row;
                    matchValue = cellStr;
                }
            }
        }
    }

    if (matchRow === -1) {
        return '#N/A';
    }

    // 一致した行の指定列の値を返す
    const result = getCellValue(
        context.cells,
        matchRow,
        resultCol,
        context.evaluateFormula,
        context.visitedCells
    );
    return result ?? '';
}

/**
 * 値が一致するかチェック（大文字小文字を区別しない文字列比較）
 * @param {*} value1 - 値1
 * @param {*} value2 - 値2
 * @returns {boolean}
 */
function valuesMatch(value1, value2) {
    // 両方nullまたは空の場合
    if ((value1 === null || value1 === '') && (value2 === null || value2 === '')) {
        return true;
    }

    // どちらかがnullまたは空の場合
    if (value1 === null || value1 === '' || value2 === null || value2 === '') {
        return false;
    }

    // 数値比較
    const num1 = toNumber(value1);
    const num2 = toNumber(value2);

    if (num1 !== null && num2 !== null) {
        return num1 === num2;
    }

    // 文字列比較（大文字小文字を区別しない）
    return String(value1).toLowerCase() === String(value2).toLowerCase();
}

/**
 * 値が真とみなされるかチェック
 * @param {*} value - チェックする値
 * @returns {boolean}
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
