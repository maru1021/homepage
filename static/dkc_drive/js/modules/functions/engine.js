/**
 * DKCドライブ - 数式エンジン
 * 数式の評価と計算を行うメインエンジン
 */

import { tokenize, parseCellRef, getCellValue, isErrorValue, toNumber, compare } from './parser.js';
import { sum } from './sum.js';
import { ifFunc } from './if.js';
import { count, counta, countblank, countif } from './count.js';
import { vlookup } from './vlookup.js';
import { sumif, averageif, sumifs, averageifs, countifs } from './sumif.js';
import { average, min, max, round, roundup, rounddown, abs, int, mod, power, sqrt } from './math.js';
import { index, match, hlookup } from './lookup.js';
import { left, right, mid, len, concatenate, concat, trim, upper, lower, proper, find, search, substitute, replace, rept, text, value, exact } from './text.js';

/**
 * 登録されている関数
 */
const FUNCTIONS = {
    // 合計・平均
    SUM: sum,
    SUMIF: sumif,
    SUMIFS: sumifs,
    AVERAGE: average,
    AVERAGEIF: averageif,
    AVERAGEIFS: averageifs,
    // カウント
    COUNT: count,
    COUNTA: counta,
    COUNTBLANK: countblank,
    COUNTIF: countif,
    COUNTIFS: countifs,
    // 最大・最小
    MIN: min,
    MAX: max,
    // 丸め
    ROUND: round,
    ROUNDUP: roundup,
    ROUNDDOWN: rounddown,
    // 数学
    ABS: abs,
    INT: int,
    MOD: mod,
    POWER: power,
    SQRT: sqrt,
    // 条件
    IF: ifFunc,
    // 検索・参照
    VLOOKUP: vlookup,
    HLOOKUP: hlookup,
    INDEX: index,
    MATCH: match,
    // 文字列
    LEFT: left,
    RIGHT: right,
    MID: mid,
    LEN: len,
    CONCATENATE: concatenate,
    CONCAT: concat,
    TRIM: trim,
    UPPER: upper,
    LOWER: lower,
    PROPER: proper,
    FIND: find,
    SEARCH: search,
    SUBSTITUTE: substitute,
    REPLACE: replace,
    REPT: rept,
    TEXT: text,
    VALUE: value,
    EXACT: exact,
};

/**
 * 数式を評価する
 * @param {string} formula - 数式（=で始まる）
 * @param {Object} cells - セルデータ
 * @param {Set} visitedCells - 訪問済みセル（循環参照検出用）
 * @returns {*} 計算結果
 */
export function evaluateFormula(formula, cells, visitedCells = new Set()) {
    if (!formula || !formula.startsWith('=')) {
        return formula;
    }

    try {
        const expression = formula.substring(1).trim();
        if (!expression) {
            return '';
        }

        const tokens = tokenize(expression);
        const context = {
            cells,
            visitedCells,
            evaluateFormula: (f, c, v) => evaluateFormula(f, c, v),
        };

        const result = parseExpression(tokens, 0, context);
        return result.value;
    } catch (e) {
        console.error('数式エラー:', e);
        return '#ERROR!';
    }
}

/**
 * 演算子の優先順位
 */
const PRECEDENCE = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
    '%': 2,
    '^': 3,
};

/**
 * 式をパース・評価
 * @param {Array} tokens - トークン配列
 * @param {number} index - 現在のインデックス
 * @param {Object} context - コンテキスト
 * @returns {{value: *, index: number}}
 */
function parseExpression(tokens, index, context) {
    return parseComparison(tokens, index, context);
}

/**
 * 比較演算をパース
 */
function parseComparison(tokens, index, context) {
    let result = parseAddSub(tokens, index, context);

    if (result.index < tokens.length) {
        const token = tokens[result.index];
        if (token.type === 'COMPARE') {
            const operator = token.value;
            const right = parseAddSub(tokens, result.index + 1, context);
            const compResult = compare(result.value, operator, right.value);
            result = { value: compResult, index: right.index };
        }
    }

    return result;
}

/**
 * 加算・減算をパース
 */
function parseAddSub(tokens, index, context) {
    let result = parseMulDiv(tokens, index, context);

    while (result.index < tokens.length) {
        const token = tokens[result.index];
        if (token.type !== 'OPERATOR' || (token.value !== '+' && token.value !== '-')) {
            break;
        }

        const operator = token.value;
        const right = parseMulDiv(tokens, result.index + 1, context);

        const leftVal = toNumber(result.value);
        const rightVal = toNumber(right.value);

        if (leftVal === null || rightVal === null) {
            result = { value: '#VALUE!', index: right.index };
        } else if (operator === '+') {
            result = { value: leftVal + rightVal, index: right.index };
        } else {
            result = { value: leftVal - rightVal, index: right.index };
        }
    }

    return result;
}

/**
 * 乗算・除算をパース
 */
function parseMulDiv(tokens, index, context) {
    let result = parsePower(tokens, index, context);

    while (result.index < tokens.length) {
        const token = tokens[result.index];
        if (token.type !== 'OPERATOR' || (token.value !== '*' && token.value !== '/' && token.value !== '%')) {
            break;
        }

        const operator = token.value;
        const right = parsePower(tokens, result.index + 1, context);

        const leftVal = toNumber(result.value);
        const rightVal = toNumber(right.value);

        if (leftVal === null || rightVal === null) {
            result = { value: '#VALUE!', index: right.index };
        } else if (operator === '*') {
            result = { value: leftVal * rightVal, index: right.index };
        } else if (operator === '/') {
            if (rightVal === 0) {
                result = { value: '#DIV/0!', index: right.index };
            } else {
                result = { value: leftVal / rightVal, index: right.index };
            }
        } else if (operator === '%') {
            result = { value: leftVal / 100, index: right.index };
        }
    }

    return result;
}

/**
 * べき乗をパース
 */
function parsePower(tokens, index, context) {
    let result = parseUnary(tokens, index, context);

    if (result.index < tokens.length) {
        const token = tokens[result.index];
        if (token.type === 'OPERATOR' && token.value === '^') {
            const right = parsePower(tokens, result.index + 1, context);

            const leftVal = toNumber(result.value);
            const rightVal = toNumber(right.value);

            if (leftVal === null || rightVal === null) {
                result = { value: '#VALUE!', index: right.index };
            } else {
                result = { value: Math.pow(leftVal, rightVal), index: right.index };
            }
        }
    }

    return result;
}

/**
 * 単項演算子をパース
 */
function parseUnary(tokens, index, context) {
    if (index >= tokens.length) {
        return { value: 0, index };
    }

    const token = tokens[index];

    // 負の数
    if (token.type === 'OPERATOR' && token.value === '-') {
        const result = parseUnary(tokens, index + 1, context);
        const val = toNumber(result.value);
        if (val === null) {
            return { value: '#VALUE!', index: result.index };
        }
        return { value: -val, index: result.index };
    }

    // 正の数（+は無視）
    if (token.type === 'OPERATOR' && token.value === '+') {
        return parseUnary(tokens, index + 1, context);
    }

    return parsePrimary(tokens, index, context);
}

/**
 * プライマリ値をパース（数値、セル参照、関数呼び出しなど）
 */
function parsePrimary(tokens, index, context) {
    if (index >= tokens.length) {
        return { value: 0, index };
    }

    const token = tokens[index];

    // 数値
    if (token.type === 'NUMBER') {
        return { value: parseFloat(token.value), index: index + 1 };
    }

    // 文字列
    if (token.type === 'STRING') {
        return { value: token.value, index: index + 1 };
    }

    // セル参照
    if (token.type === 'CELL') {
        const cellRef = parseCellRef(token.value);
        if (!cellRef) {
            return { value: '#REF!', index: index + 1 };
        }

        const value = getCellValue(
            context.cells,
            cellRef.row,
            cellRef.col,
            context.evaluateFormula,
            context.visitedCells
        );

        return { value: value ?? 0, index: index + 1 };
    }

    // 範囲参照（単独では使用できない）
    if (token.type === 'RANGE') {
        return { value: '#VALUE!', index: index + 1 };
    }

    // 関数呼び出し
    if (token.type === 'FUNCTION') {
        return parseFunction(tokens, index, context);
    }

    // 括弧
    if (token.type === 'LPAREN') {
        const result = parseExpression(tokens, index + 1, context);
        // 閉じ括弧をスキップ
        let newIndex = result.index;
        if (newIndex < tokens.length && tokens[newIndex].type === 'RPAREN') {
            newIndex++;
        }
        return { value: result.value, index: newIndex };
    }

    // 比較演算子（IF関数内で使用）
    if (token.type === 'COMPARE') {
        return { value: token.value, index: index + 1 };
    }

    return { value: 0, index: index + 1 };
}

/**
 * 関数呼び出しをパース
 */
function parseFunction(tokens, index, context) {
    const funcName = tokens[index].value;
    const func = FUNCTIONS[funcName];

    if (!func) {
        return { value: '#NAME?', index: index + 1 };
    }

    index++; // 関数名をスキップ

    // 開き括弧をスキップ
    if (index < tokens.length && tokens[index].type === 'LPAREN') {
        index++;
    } else {
        return { value: '#ERROR!', index };
    }

    // 引数をパース
    const args = [];
    const rawArgs = []; // 生のトークン情報（範囲参照用）

    while (index < tokens.length && tokens[index].type !== 'RPAREN') {
        // 範囲参照を保持（SUM等で使用）
        if (tokens[index].type === 'RANGE') {
            rawArgs.push({ type: 'RANGE', value: tokens[index].value });
            args.push(tokens[index].value);
            index++;
        } else if (tokens[index].type === 'COMMA') {
            index++;
        } else {
            // CELL参照も含めてparseExpressionで処理（比較式A2=1などに対応）
            const result = parseExpression(tokens, index, context);
            rawArgs.push({ type: 'VALUE', value: result.value });
            args.push(result.value);
            index = result.index;
        }
    }

    // 閉じ括弧をスキップ
    if (index < tokens.length && tokens[index].type === 'RPAREN') {
        index++;
    }

    // 関数を実行
    try {
        const result = func(args, rawArgs, context);
        return { value: result, index };
    } catch (e) {
        console.error(`関数${funcName}エラー:`, e);
        return { value: '#ERROR!', index };
    }
}
