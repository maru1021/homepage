/**
 * DKCドライブ - SUMIF / SUMIFS / AVERAGEIF / AVERAGEIFS関数
 * 条件に一致するセルの合計・平均を計算
 */

import { getRangeValues, parseRangeRef, getCellValue, toNumber, isErrorValue } from './parser.js';

/**
 * SUMIF関数: 条件に一致するセルの合計を計算
 * @param {Array} args - 評価済み引数 [範囲, 条件, 合計範囲]
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number|string} 合計値またはエラー
 *
 * 使用例:
 * =SUMIF(A1:A10,">10")           - A1:A10で10より大きい値の合計
 * =SUMIF(A1:A10,"りんご",B1:B10)  - A1:A10が"りんご"の行のB1:B10の合計
 * =SUMIF(A1:A10,">=100",C1:C10)  - A1:A10が100以上の行のC1:C10の合計
 */
export function sumif(args, rawArgs, context) {
    if (args.length < 2 || rawArgs.length < 1) {
        return '#VALUE!';
    }

    const rangeArg = rawArgs[0];
    const criteria = args[1];
    const sumRangeArg = rawArgs.length >= 3 ? rawArgs[2] : null;

    if (rangeArg.type !== 'RANGE') {
        return '#VALUE!';
    }

    // 範囲をパース
    const range = parseRangeRef(rangeArg.value);
    if (!range) {
        return '#REF!';
    }

    // 合計範囲をパース（指定がない場合は条件範囲と同じ）
    let sumRange = range;
    if (sumRangeArg && sumRangeArg.type === 'RANGE') {
        const parsed = parseRangeRef(sumRangeArg.value);
        if (parsed) {
            sumRange = parsed;
        }
    }

    const { start, end } = range;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const sumStart = sumRange.start;
    const sumMinRow = Math.min(sumRange.start.row, sumRange.end.row);
    const sumMinCol = Math.min(sumRange.start.col, sumRange.end.col);

    // 条件をパース
    const { operator, compareValue } = parseCriteria(String(criteria));

    let total = 0;

    // 条件範囲を走査
    for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
            const cellValue = getCellValue(
                context.cells,
                row,
                col,
                context.evaluateFormula,
                context.visitedCells
            );

            if (isErrorValue(cellValue)) {
                continue;
            }

            if (matchesCriteria(cellValue, operator, compareValue)) {
                // 条件に一致した場合、対応する合計範囲のセルを加算
                const sumRow = sumMinRow + (row - minRow);
                const sumCol = sumMinCol + (col - minCol);

                const sumValue = getCellValue(
                    context.cells,
                    sumRow,
                    sumCol,
                    context.evaluateFormula,
                    context.visitedCells
                );

                if (!isErrorValue(sumValue)) {
                    const num = toNumber(sumValue);
                    if (num !== null) {
                        total += num;
                    }
                }
            }
        }
    }

    return total;
}

/**
 * AVERAGEIF関数: 条件に一致するセルの平均を計算
 * @param {Array} args - 評価済み引数 [範囲, 条件, 平均範囲]
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number|string} 平均値またはエラー
 *
 * 使用例:
 * =AVERAGEIF(A1:A10,">10")           - A1:A10で10より大きい値の平均
 * =AVERAGEIF(A1:A10,"りんご",B1:B10)  - A1:A10が"りんご"の行のB1:B10の平均
 */
export function averageif(args, rawArgs, context) {
    if (args.length < 2 || rawArgs.length < 1) {
        return '#VALUE!';
    }

    const rangeArg = rawArgs[0];
    const criteria = args[1];
    const avgRangeArg = rawArgs.length >= 3 ? rawArgs[2] : null;

    if (rangeArg.type !== 'RANGE') {
        return '#VALUE!';
    }

    // 範囲をパース
    const range = parseRangeRef(rangeArg.value);
    if (!range) {
        return '#REF!';
    }

    // 平均範囲をパース（指定がない場合は条件範囲と同じ）
    let avgRange = range;
    if (avgRangeArg && avgRangeArg.type === 'RANGE') {
        const parsed = parseRangeRef(avgRangeArg.value);
        if (parsed) {
            avgRange = parsed;
        }
    }

    const { start, end } = range;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const avgMinRow = Math.min(avgRange.start.row, avgRange.end.row);
    const avgMinCol = Math.min(avgRange.start.col, avgRange.end.col);

    // 条件をパース
    const { operator, compareValue } = parseCriteria(String(criteria));

    let total = 0;
    let count = 0;

    // 条件範囲を走査
    for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
            const cellValue = getCellValue(
                context.cells,
                row,
                col,
                context.evaluateFormula,
                context.visitedCells
            );

            if (isErrorValue(cellValue)) {
                continue;
            }

            if (matchesCriteria(cellValue, operator, compareValue)) {
                // 条件に一致した場合、対応する平均範囲のセルを加算
                const avgRow = avgMinRow + (row - minRow);
                const avgCol = avgMinCol + (col - minCol);

                const avgValue = getCellValue(
                    context.cells,
                    avgRow,
                    avgCol,
                    context.evaluateFormula,
                    context.visitedCells
                );

                if (!isErrorValue(avgValue)) {
                    const num = toNumber(avgValue);
                    if (num !== null) {
                        total += num;
                        count++;
                    }
                }
            }
        }
    }

    if (count === 0) {
        return '#DIV/0!';
    }

    return total / count;
}

/**
 * 条件文字列をパース
 * @param {string} criteria - 条件文字列（例: ">10", "りんご", "<>5"）
 * @returns {{operator: string, compareValue: *}}
 */
function parseCriteria(criteria) {
    // 比較演算子を検出
    const operators = ['<>', '<=', '>=', '<', '>', '='];

    for (const op of operators) {
        if (criteria.startsWith(op)) {
            const valueStr = criteria.substring(op.length);
            const num = parseFloat(valueStr);
            return {
                operator: op,
                compareValue: !isNaN(num) && isFinite(num) ? num : valueStr
            };
        }
    }

    // 演算子がない場合は等価比較
    const num = parseFloat(criteria);
    return {
        operator: '=',
        compareValue: !isNaN(num) && isFinite(num) ? num : criteria
    };
}

/**
 * 値が条件に一致するかチェック
 * @param {*} value - チェックする値
 * @param {string} operator - 比較演算子
 * @param {*} compareValue - 比較する値
 * @returns {boolean}
 */
function matchesCriteria(value, operator, compareValue) {
    const numValue = toNumber(value);
    const numCompare = toNumber(compareValue);

    // 両方数値の場合は数値比較
    if (numValue !== null && numCompare !== null) {
        switch (operator) {
            case '=': return numValue === numCompare;
            case '<>': return numValue !== numCompare;
            case '<': return numValue < numCompare;
            case '>': return numValue > numCompare;
            case '<=': return numValue <= numCompare;
            case '>=': return numValue >= numCompare;
            default: return false;
        }
    }

    // 文字列比較（大文字小文字を区別しない）
    const strValue = String(value ?? '').toLowerCase();
    const strCompare = String(compareValue ?? '').toLowerCase();

    // ワイルドカード対応（* と ?）
    if (typeof compareValue === 'string' && (compareValue.includes('*') || compareValue.includes('?'))) {
        return matchWildcard(strValue, strCompare);
    }

    switch (operator) {
        case '=': return strValue === strCompare;
        case '<>': return strValue !== strCompare;
        case '<': return strValue < strCompare;
        case '>': return strValue > strCompare;
        case '<=': return strValue <= strCompare;
        case '>=': return strValue >= strCompare;
        default: return false;
    }
}

/**
 * ワイルドカードマッチング
 * @param {string} text - テキスト
 * @param {string} pattern - パターン（* と ? を含む）
 * @returns {boolean}
 */
function matchWildcard(text, pattern) {
    // * を .* に、? を . に変換して正規表現に
    const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 正規表現のメタ文字をエスケープ
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');

    try {
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(text);
    } catch (e) {
        return false;
    }
}

/**
 * SUMIFS関数: 複数条件に一致するセルの合計を計算
 * @param {Array} args - 評価済み引数 [合計範囲, 条件範囲1, 条件1, 条件範囲2, 条件2, ...]
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number|string} 合計値またはエラー
 *
 * 使用例:
 * =SUMIFS(C1:C10,A1:A10,"りんご",B1:B10,">100")
 *   - A列が"りんご"かつB列が100より大きい行のC列の合計
 */
export function sumifs(args, rawArgs, context) {
    if (args.length < 3 || rawArgs.length < 3) {
        return '#VALUE!';
    }

    const sumRangeArg = rawArgs[0];
    if (sumRangeArg.type !== 'RANGE') {
        return '#VALUE!';
    }

    const sumRange = parseRangeRef(sumRangeArg.value);
    if (!sumRange) {
        return '#REF!';
    }

    // 条件ペアを収集
    const criteriaList = [];
    for (let i = 1; i + 1 < rawArgs.length; i += 2) {
        const rangeArg = rawArgs[i];
        const criteria = args[i + 1];

        if (rangeArg.type !== 'RANGE') {
            return '#VALUE!';
        }

        const range = parseRangeRef(rangeArg.value);
        if (!range) {
            return '#REF!';
        }

        criteriaList.push({
            range,
            ...parseCriteria(String(criteria))
        });
    }

    const sumStart = sumRange.start;
    const sumMinRow = Math.min(sumRange.start.row, sumRange.end.row);
    const sumMaxRow = Math.max(sumRange.start.row, sumRange.end.row);
    const sumMinCol = Math.min(sumRange.start.col, sumRange.end.col);

    let total = 0;

    // 合計範囲の各行をチェック
    for (let rowOffset = 0; rowOffset <= sumMaxRow - sumMinRow; rowOffset++) {
        let allMatch = true;

        // すべての条件をチェック
        for (const crit of criteriaList) {
            const critMinRow = Math.min(crit.range.start.row, crit.range.end.row);
            const critMinCol = Math.min(crit.range.start.col, crit.range.end.col);

            const cellValue = getCellValue(
                context.cells,
                critMinRow + rowOffset,
                critMinCol,
                context.evaluateFormula,
                context.visitedCells
            );

            if (!matchesCriteria(cellValue, crit.operator, crit.compareValue)) {
                allMatch = false;
                break;
            }
        }

        if (allMatch) {
            const sumValue = getCellValue(
                context.cells,
                sumMinRow + rowOffset,
                sumMinCol,
                context.evaluateFormula,
                context.visitedCells
            );

            if (!isErrorValue(sumValue)) {
                const num = toNumber(sumValue);
                if (num !== null) {
                    total += num;
                }
            }
        }
    }

    return total;
}

/**
 * AVERAGEIFS関数: 複数条件に一致するセルの平均を計算
 * @param {Array} args - 評価済み引数 [平均範囲, 条件範囲1, 条件1, 条件範囲2, 条件2, ...]
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number|string} 平均値またはエラー
 *
 * 使用例:
 * =AVERAGEIFS(C1:C10,A1:A10,"りんご",B1:B10,">100")
 *   - A列が"りんご"かつB列が100より大きい行のC列の平均
 */
export function averageifs(args, rawArgs, context) {
    if (args.length < 3 || rawArgs.length < 3) {
        return '#VALUE!';
    }

    const avgRangeArg = rawArgs[0];
    if (avgRangeArg.type !== 'RANGE') {
        return '#VALUE!';
    }

    const avgRange = parseRangeRef(avgRangeArg.value);
    if (!avgRange) {
        return '#REF!';
    }

    // 条件ペアを収集
    const criteriaList = [];
    for (let i = 1; i + 1 < rawArgs.length; i += 2) {
        const rangeArg = rawArgs[i];
        const criteria = args[i + 1];

        if (rangeArg.type !== 'RANGE') {
            return '#VALUE!';
        }

        const range = parseRangeRef(rangeArg.value);
        if (!range) {
            return '#REF!';
        }

        criteriaList.push({
            range,
            ...parseCriteria(String(criteria))
        });
    }

    const avgMinRow = Math.min(avgRange.start.row, avgRange.end.row);
    const avgMaxRow = Math.max(avgRange.start.row, avgRange.end.row);
    const avgMinCol = Math.min(avgRange.start.col, avgRange.end.col);

    let total = 0;
    let count = 0;

    // 平均範囲の各行をチェック
    for (let rowOffset = 0; rowOffset <= avgMaxRow - avgMinRow; rowOffset++) {
        let allMatch = true;

        // すべての条件をチェック
        for (const crit of criteriaList) {
            const critMinRow = Math.min(crit.range.start.row, crit.range.end.row);
            const critMinCol = Math.min(crit.range.start.col, crit.range.end.col);

            const cellValue = getCellValue(
                context.cells,
                critMinRow + rowOffset,
                critMinCol,
                context.evaluateFormula,
                context.visitedCells
            );

            if (!matchesCriteria(cellValue, crit.operator, crit.compareValue)) {
                allMatch = false;
                break;
            }
        }

        if (allMatch) {
            const avgValue = getCellValue(
                context.cells,
                avgMinRow + rowOffset,
                avgMinCol,
                context.evaluateFormula,
                context.visitedCells
            );

            if (!isErrorValue(avgValue)) {
                const num = toNumber(avgValue);
                if (num !== null) {
                    total += num;
                    count++;
                }
            }
        }
    }

    if (count === 0) {
        return '#DIV/0!';
    }

    return total / count;
}

/**
 * COUNTIFS関数: 複数条件に一致するセルの数をカウント
 * @param {Array} args - 評価済み引数 [条件範囲1, 条件1, 条件範囲2, 条件2, ...]
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number|string} カウントまたはエラー
 *
 * 使用例:
 * =COUNTIFS(A1:A10,"りんご",B1:B10,">100")
 *   - A列が"りんご"かつB列が100より大きい行の数
 */
export function countifs(args, rawArgs, context) {
    if (args.length < 2 || rawArgs.length < 2) {
        return '#VALUE!';
    }

    // 条件ペアを収集
    const criteriaList = [];
    for (let i = 0; i + 1 < rawArgs.length; i += 2) {
        const rangeArg = rawArgs[i];
        const criteria = args[i + 1];

        if (rangeArg.type !== 'RANGE') {
            return '#VALUE!';
        }

        const range = parseRangeRef(rangeArg.value);
        if (!range) {
            return '#REF!';
        }

        criteriaList.push({
            range,
            ...parseCriteria(String(criteria))
        });
    }

    if (criteriaList.length === 0) {
        return '#VALUE!';
    }

    // 最初の条件範囲を基準にする
    const baseRange = criteriaList[0].range;
    const baseMinRow = Math.min(baseRange.start.row, baseRange.end.row);
    const baseMaxRow = Math.max(baseRange.start.row, baseRange.end.row);

    let count = 0;

    // 各行をチェック
    for (let rowOffset = 0; rowOffset <= baseMaxRow - baseMinRow; rowOffset++) {
        let allMatch = true;

        // すべての条件をチェック
        for (const crit of criteriaList) {
            const critMinRow = Math.min(crit.range.start.row, crit.range.end.row);
            const critMinCol = Math.min(crit.range.start.col, crit.range.end.col);

            const cellValue = getCellValue(
                context.cells,
                critMinRow + rowOffset,
                critMinCol,
                context.evaluateFormula,
                context.visitedCells
            );

            if (!matchesCriteria(cellValue, crit.operator, crit.compareValue)) {
                allMatch = false;
                break;
            }
        }

        if (allMatch) {
            count++;
        }
    }

    return count;
}
