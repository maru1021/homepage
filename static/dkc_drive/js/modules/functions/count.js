/**
 * DKCドライブ - COUNT / COUNTA / COUNTIF関数
 * セルのカウント機能
 */

import { getRangeValues, toNumber, isErrorValue } from './parser.js';

/**
 * COUNT関数: 数値が含まれるセルの数をカウント
 * @param {Array} args - 評価済み引数
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number} 数値セルの数
 *
 * 使用例:
 * =COUNT(A1:A10)      - A1からA10で数値が入っているセルの数
 * =COUNT(A1,B1,C1)    - 指定セルで数値が入っている数
 * =COUNT(A1:A5,B1:B5) - 複数範囲の数値セルの数
 */
export function count(args, rawArgs, context) {
    let total = 0;

    for (let i = 0; i < rawArgs.length; i++) {
        const rawArg = rawArgs[i];

        if (rawArg.type === 'RANGE') {
            // 範囲参照の場合
            const values = getRangeValues(
                rawArg.value,
                context.cells,
                context.evaluateFormula,
                context.visitedCells
            );

            for (const value of values) {
                if (isErrorValue(value)) {
                    continue; // エラーはカウントしない
                }

                const num = toNumber(value);
                if (num !== null) {
                    total++;
                }
            }
        } else {
            // 単一値の場合
            const value = args[i];

            if (!isErrorValue(value)) {
                const num = toNumber(value);
                if (num !== null) {
                    total++;
                }
            }
        }
    }

    return total;
}

/**
 * COUNTA関数: 空でないセルの数をカウント
 * @param {Array} args - 評価済み引数
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number} 空でないセルの数
 *
 * 使用例:
 * =COUNTA(A1:A10)      - A1からA10で空でないセルの数
 * =COUNTA(A1,B1,C1)    - 指定セルで空でない数
 * =COUNTA(A1:A5,B1:B5) - 複数範囲の空でないセルの数
 */
export function counta(args, rawArgs, context) {
    let total = 0;

    for (let i = 0; i < rawArgs.length; i++) {
        const rawArg = rawArgs[i];

        if (rawArg.type === 'RANGE') {
            // 範囲参照の場合
            const values = getRangeValues(
                rawArg.value,
                context.cells,
                context.evaluateFormula,
                context.visitedCells
            );

            for (const value of values) {
                // 空でなければカウント（エラー値もカウント）
                if (value !== null && value !== undefined && value !== '') {
                    total++;
                }
            }
        } else {
            // 単一値の場合
            const value = args[i];

            if (value !== null && value !== undefined && value !== '') {
                total++;
            }
        }
    }

    return total;
}

/**
 * COUNTBLANK関数: 空のセルの数をカウント
 * @param {Array} args - 評価済み引数
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number} 空のセルの数
 *
 * 使用例:
 * =COUNTBLANK(A1:A10)  - A1からA10で空のセルの数
 */
export function countblank(args, rawArgs, context) {
    let total = 0;

    for (let i = 0; i < rawArgs.length; i++) {
        const rawArg = rawArgs[i];

        if (rawArg.type === 'RANGE') {
            // 範囲参照の場合
            const values = getRangeValues(
                rawArg.value,
                context.cells,
                context.evaluateFormula,
                context.visitedCells
            );

            for (const value of values) {
                // 空ならカウント
                if (value === null || value === undefined || value === '') {
                    total++;
                }
            }
        } else {
            // 単一値の場合
            const value = args[i];

            if (value === null || value === undefined || value === '') {
                total++;
            }
        }
    }

    return total;
}

/**
 * COUNTIF関数: 条件に一致するセルの数をカウント
 * @param {Array} args - 評価済み引数 [範囲, 条件]
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number} 条件に一致するセルの数
 *
 * 使用例:
 * =COUNTIF(A1:A10,">10")    - 10より大きい値のセル数
 * =COUNTIF(A1:A10,"りんご")  - "りんご"と等しいセルの数
 * =COUNTIF(A1:A10,"<>")     - 空でないセルの数
 * =COUNTIF(A1:A10,">=5")    - 5以上の値のセル数
 */
export function countif(args, rawArgs, context) {
    if (args.length < 2 || rawArgs.length < 1) {
        return '#VALUE!';
    }

    const rangeArg = rawArgs[0];
    const criteria = args[1];

    if (rangeArg.type !== 'RANGE') {
        return '#VALUE!';
    }

    // 範囲内のすべての値を取得
    const values = getRangeValues(
        rangeArg.value,
        context.cells,
        context.evaluateFormula,
        context.visitedCells
    );

    // 条件をパース
    const { operator, compareValue } = parseCriteria(String(criteria));

    let total = 0;

    for (const value of values) {
        if (isErrorValue(value)) {
            continue;
        }

        if (matchesCriteria(value, operator, compareValue)) {
            total++;
        }
    }

    return total;
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
