/**
 * DKCドライブ - SUM関数
 * 指定した範囲またはセルの合計を計算
 */

import { getRangeValues, toNumber, getCellValue, isErrorValue } from './parser.js';

/**
 * SUM関数: 引数の合計を計算
 * @param {Array} args - 評価済み引数
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number|string} 合計値またはエラー
 *
 * 使用例:
 * =SUM(A1:A10)      - A1からA10までの合計
 * =SUM(A1,B1,C1)    - A1, B1, C1の合計
 * =SUM(A1:A5,B1:B5) - 複数範囲の合計
 * =SUM(1,2,3)       - 数値の合計
 */
export function sum(args, rawArgs, context) {
    let total = 0;
    let hasValue = false;

    for (let i = 0; i < rawArgs.length; i++) {
        const rawArg = rawArgs[i];

        if (rawArg.type === 'RANGE') {
            // 範囲参照の場合、範囲内のすべてのセル値を取得
            const values = getRangeValues(
                rawArg.value,
                context.cells,
                context.evaluateFormula,
                context.visitedCells
            );

            for (const value of values) {
                if (isErrorValue(value)) {
                    return value; // エラーを伝播
                }

                const num = toNumber(value);
                if (num !== null) {
                    total += num;
                    hasValue = true;
                }
                // 文字列は無視（Excelと同じ動作）
            }
        } else {
            // 単一値の場合
            const value = args[i];

            if (isErrorValue(value)) {
                return value;
            }

            const num = toNumber(value);
            if (num !== null) {
                total += num;
                hasValue = true;
            }
        }
    }

    return total;
}
