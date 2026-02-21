/**
 * DKCドライブ - IF関数
 * 条件に基づいて値を返す
 */

import { isErrorValue, compare } from './parser.js';

/**
 * IF関数: 条件式を評価し、真の場合と偽の場合で異なる値を返す
 * @param {Array} args - 評価済み引数 [条件, 真の値, 偽の値]
 * @param {Array} rawArgs - 生の引数
 * @param {Object} context - コンテキスト
 * @returns {*} 条件に応じた値
 *
 * 使用例:
 * =IF(A1>10,"大","小")     - A1が10より大きければ"大"、そうでなければ"小"
 * =IF(A1=B1,1,0)           - A1とB1が等しければ1、そうでなければ0
 * =IF(A1<>0,A1,"空")       - A1が0でなければA1の値、そうでなければ"空"
 */
export function ifFunc(args, rawArgs, context) {
    if (args.length < 2) {
        return '#VALUE!';
    }

    const condition = args[0];
    const trueValue = args.length >= 2 ? args[1] : true;
    const falseValue = args.length >= 3 ? args[2] : false;

    // エラーチェック
    if (isErrorValue(condition)) {
        return condition;
    }

    // 条件を評価
    let result = false;

    if (typeof condition === 'boolean') {
        result = condition;
    } else if (typeof condition === 'number') {
        result = condition !== 0;
    } else if (typeof condition === 'string') {
        // 文字列の場合、"TRUE"/"FALSE" または数値として評価
        const upper = condition.toUpperCase();
        if (upper === 'TRUE') {
            result = true;
        } else if (upper === 'FALSE') {
            result = false;
        } else {
            const num = parseFloat(condition);
            result = !isNaN(num) && num !== 0;
        }
    }

    return result ? trueValue : falseValue;
}

/**
 * 条件式をパースして評価する補助関数
 * IF関数の第一引数として渡される比較式を評価
 * 注意: 現在の実装ではエンジン側で比較演算が処理されるため、
 * この関数は主にデバッグ・テスト用途
 */
export function evaluateCondition(left, operator, right) {
    return compare(left, operator, right);
}
