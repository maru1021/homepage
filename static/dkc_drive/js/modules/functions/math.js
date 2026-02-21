/**
 * DKCドライブ - 数学関数
 * AVERAGE, MIN, MAX, ROUND, ROUNDUP, ROUNDDOWN, ABS, INT, MOD
 */

import { getRangeValues, toNumber, isErrorValue } from './parser.js';

/**
 * AVERAGE関数: 引数の平均を計算
 * @param {Array} args - 評価済み引数
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number|string} 平均値またはエラー
 *
 * 使用例:
 * =AVERAGE(A1:A10)      - A1からA10までの平均
 * =AVERAGE(A1,B1,C1)    - A1, B1, C1の平均
 * =AVERAGE(1,2,3,4,5)   - 数値の平均
 */
export function average(args, rawArgs, context) {
    let total = 0;
    let count = 0;

    for (let i = 0; i < rawArgs.length; i++) {
        const rawArg = rawArgs[i];

        if (rawArg.type === 'RANGE') {
            const values = getRangeValues(
                rawArg.value,
                context.cells,
                context.evaluateFormula,
                context.visitedCells
            );

            for (const value of values) {
                if (isErrorValue(value)) {
                    return value;
                }

                const num = toNumber(value);
                if (num !== null) {
                    total += num;
                    count++;
                }
            }
        } else {
            const value = args[i];

            if (isErrorValue(value)) {
                return value;
            }

            const num = toNumber(value);
            if (num !== null) {
                total += num;
                count++;
            }
        }
    }

    if (count === 0) {
        return '#DIV/0!';
    }

    return total / count;
}

/**
 * MIN関数: 引数の最小値を返す
 * @param {Array} args - 評価済み引数
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number|string} 最小値またはエラー
 *
 * 使用例:
 * =MIN(A1:A10)      - A1からA10までの最小値
 * =MIN(A1,B1,C1)    - A1, B1, C1の最小値
 * =MIN(1,2,3,4,5)   - 数値の最小値（1）
 */
export function min(args, rawArgs, context) {
    let minValue = null;

    for (let i = 0; i < rawArgs.length; i++) {
        const rawArg = rawArgs[i];

        if (rawArg.type === 'RANGE') {
            const values = getRangeValues(
                rawArg.value,
                context.cells,
                context.evaluateFormula,
                context.visitedCells
            );

            for (const value of values) {
                if (isErrorValue(value)) {
                    return value;
                }

                const num = toNumber(value);
                if (num !== null) {
                    if (minValue === null || num < minValue) {
                        minValue = num;
                    }
                }
            }
        } else {
            const value = args[i];

            if (isErrorValue(value)) {
                return value;
            }

            const num = toNumber(value);
            if (num !== null) {
                if (minValue === null || num < minValue) {
                    minValue = num;
                }
            }
        }
    }

    return minValue !== null ? minValue : 0;
}

/**
 * MAX関数: 引数の最大値を返す
 * @param {Array} args - 評価済み引数
 * @param {Array} rawArgs - 生の引数（範囲参照情報を含む）
 * @param {Object} context - コンテキスト
 * @returns {number|string} 最大値またはエラー
 *
 * 使用例:
 * =MAX(A1:A10)      - A1からA10までの最大値
 * =MAX(A1,B1,C1)    - A1, B1, C1の最大値
 * =MAX(1,2,3,4,5)   - 数値の最大値（5）
 */
export function max(args, rawArgs, context) {
    let maxValue = null;

    for (let i = 0; i < rawArgs.length; i++) {
        const rawArg = rawArgs[i];

        if (rawArg.type === 'RANGE') {
            const values = getRangeValues(
                rawArg.value,
                context.cells,
                context.evaluateFormula,
                context.visitedCells
            );

            for (const value of values) {
                if (isErrorValue(value)) {
                    return value;
                }

                const num = toNumber(value);
                if (num !== null) {
                    if (maxValue === null || num > maxValue) {
                        maxValue = num;
                    }
                }
            }
        } else {
            const value = args[i];

            if (isErrorValue(value)) {
                return value;
            }

            const num = toNumber(value);
            if (num !== null) {
                if (maxValue === null || num > maxValue) {
                    maxValue = num;
                }
            }
        }
    }

    return maxValue !== null ? maxValue : 0;
}

/**
 * ROUND関数: 指定した桁数に四捨五入
 * @param {Array} args - 評価済み引数 [数値, 桁数]
 * @param {Array} rawArgs - 生の引数
 * @param {Object} context - コンテキスト
 * @returns {number|string} 四捨五入した値またはエラー
 *
 * 使用例:
 * =ROUND(3.14159, 2)   - 3.14
 * =ROUND(1234, -2)     - 1200（百の位で四捨五入）
 * =ROUND(A1, 0)        - A1を整数に四捨五入
 */
export function round(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const value = args[0];
    if (isErrorValue(value)) {
        return value;
    }

    const num = toNumber(value);
    if (num === null) {
        return '#VALUE!';
    }

    const digits = args.length >= 2 ? toNumber(args[1]) : 0;
    if (digits === null) {
        return '#VALUE!';
    }

    const factor = Math.pow(10, digits);
    return Math.round(num * factor) / factor;
}

/**
 * ROUNDUP関数: 指定した桁数に切り上げ
 * @param {Array} args - 評価済み引数 [数値, 桁数]
 * @param {Array} rawArgs - 生の引数
 * @param {Object} context - コンテキスト
 * @returns {number|string} 切り上げした値またはエラー
 *
 * 使用例:
 * =ROUNDUP(3.14159, 2)   - 3.15
 * =ROUNDUP(1234, -2)     - 1300
 * =ROUNDUP(-3.14, 1)     - -3.2（絶対値で切り上げ）
 */
export function roundup(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const value = args[0];
    if (isErrorValue(value)) {
        return value;
    }

    const num = toNumber(value);
    if (num === null) {
        return '#VALUE!';
    }

    const digits = args.length >= 2 ? toNumber(args[1]) : 0;
    if (digits === null) {
        return '#VALUE!';
    }

    const factor = Math.pow(10, digits);
    // 絶対値で切り上げ（Excelと同じ動作）
    if (num >= 0) {
        return Math.ceil(num * factor) / factor;
    } else {
        return -Math.ceil(Math.abs(num) * factor) / factor;
    }
}

/**
 * ROUNDDOWN関数: 指定した桁数に切り捨て
 * @param {Array} args - 評価済み引数 [数値, 桁数]
 * @param {Array} rawArgs - 生の引数
 * @param {Object} context - コンテキスト
 * @returns {number|string} 切り捨てした値またはエラー
 *
 * 使用例:
 * =ROUNDDOWN(3.14159, 2)   - 3.14
 * =ROUNDDOWN(1234, -2)     - 1200
 * =ROUNDDOWN(-3.14, 1)     - -3.1（絶対値で切り捨て）
 */
export function rounddown(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const value = args[0];
    if (isErrorValue(value)) {
        return value;
    }

    const num = toNumber(value);
    if (num === null) {
        return '#VALUE!';
    }

    const digits = args.length >= 2 ? toNumber(args[1]) : 0;
    if (digits === null) {
        return '#VALUE!';
    }

    const factor = Math.pow(10, digits);
    // 絶対値で切り捨て（Excelと同じ動作）
    if (num >= 0) {
        return Math.floor(num * factor) / factor;
    } else {
        return -Math.floor(Math.abs(num) * factor) / factor;
    }
}

/**
 * ABS関数: 絶対値を返す
 * @param {Array} args - 評価済み引数 [数値]
 * @param {Array} rawArgs - 生の引数
 * @param {Object} context - コンテキスト
 * @returns {number|string} 絶対値またはエラー
 *
 * 使用例:
 * =ABS(-5)   - 5
 * =ABS(A1)   - A1の絶対値
 */
export function abs(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const value = args[0];
    if (isErrorValue(value)) {
        return value;
    }

    const num = toNumber(value);
    if (num === null) {
        return '#VALUE!';
    }

    return Math.abs(num);
}

/**
 * INT関数: 数値の整数部分を返す（切り捨て）
 * @param {Array} args - 評価済み引数 [数値]
 * @param {Array} rawArgs - 生の引数
 * @param {Object} context - コンテキスト
 * @returns {number|string} 整数部分またはエラー
 *
 * 使用例:
 * =INT(8.9)    - 8
 * =INT(-8.9)   - -9（負の無限大方向に丸める）
 */
export function int(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const value = args[0];
    if (isErrorValue(value)) {
        return value;
    }

    const num = toNumber(value);
    if (num === null) {
        return '#VALUE!';
    }

    return Math.floor(num);
}

/**
 * MOD関数: 剰余（余り）を返す
 * @param {Array} args - 評価済み引数 [数値, 除数]
 * @param {Array} rawArgs - 生の引数
 * @param {Object} context - コンテキスト
 * @returns {number|string} 剰余またはエラー
 *
 * 使用例:
 * =MOD(10, 3)   - 1
 * =MOD(-10, 3)  - 2（Excelと同じ動作：結果は除数と同じ符号）
 */
export function mod(args, rawArgs, context) {
    if (args.length < 2) {
        return '#VALUE!';
    }

    const numValue = args[0];
    const divValue = args[1];

    if (isErrorValue(numValue)) return numValue;
    if (isErrorValue(divValue)) return divValue;

    const num = toNumber(numValue);
    const div = toNumber(divValue);

    if (num === null || div === null) {
        return '#VALUE!';
    }

    if (div === 0) {
        return '#DIV/0!';
    }

    // Excelと同じ動作：結果は除数と同じ符号
    const result = num % div;
    if (result !== 0 && ((result > 0) !== (div > 0))) {
        return result + div;
    }
    return result;
}

/**
 * POWER関数: べき乗を返す
 * @param {Array} args - 評価済み引数 [底, 指数]
 * @param {Array} rawArgs - 生の引数
 * @param {Object} context - コンテキスト
 * @returns {number|string} べき乗またはエラー
 *
 * 使用例:
 * =POWER(2, 3)   - 8
 * =POWER(4, 0.5) - 2（平方根）
 */
export function power(args, rawArgs, context) {
    if (args.length < 2) {
        return '#VALUE!';
    }

    const baseValue = args[0];
    const expValue = args[1];

    if (isErrorValue(baseValue)) return baseValue;
    if (isErrorValue(expValue)) return expValue;

    const base = toNumber(baseValue);
    const exp = toNumber(expValue);

    if (base === null || exp === null) {
        return '#VALUE!';
    }

    return Math.pow(base, exp);
}

/**
 * SQRT関数: 平方根を返す
 * @param {Array} args - 評価済み引数 [数値]
 * @param {Array} rawArgs - 生の引数
 * @param {Object} context - コンテキスト
 * @returns {number|string} 平方根またはエラー
 *
 * 使用例:
 * =SQRT(16)   - 4
 * =SQRT(2)    - 1.414...
 */
export function sqrt(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const value = args[0];
    if (isErrorValue(value)) {
        return value;
    }

    const num = toNumber(value);
    if (num === null) {
        return '#VALUE!';
    }

    if (num < 0) {
        return '#NUM!';
    }

    return Math.sqrt(num);
}
