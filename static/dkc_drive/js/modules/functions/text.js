/**
 * DKCドライブ - 文字列関数
 * LEFT, RIGHT, MID, LEN, CONCATENATE, TRIM, UPPER, LOWER, FIND, SUBSTITUTE, TEXT, VALUE
 */

import { toNumber, isErrorValue } from './parser.js';

/**
 * LEFT関数: 文字列の左から指定した文字数を取得
 * @param {Array} args - 評価済み引数 [文字列, 文字数]
 * @returns {string} 取得した文字列
 *
 * 使用例:
 * =LEFT("こんにちは", 3)   - "こんに"
 * =LEFT("ABC", 2)          - "AB"
 */
export function left(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const text = String(args[0] ?? '');
    const numChars = args.length >= 2 ? toNumber(args[1]) : 1;

    if (numChars === null || numChars < 0) {
        return '#VALUE!';
    }

    return text.substring(0, numChars);
}

/**
 * RIGHT関数: 文字列の右から指定した文字数を取得
 * @param {Array} args - 評価済み引数 [文字列, 文字数]
 * @returns {string} 取得した文字列
 *
 * 使用例:
 * =RIGHT("こんにちは", 3)   - "ちは"（注：JavaScriptは1文字2バイトではない）
 * =RIGHT("ABC", 2)          - "BC"
 */
export function right(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const text = String(args[0] ?? '');
    const numChars = args.length >= 2 ? toNumber(args[1]) : 1;

    if (numChars === null || numChars < 0) {
        return '#VALUE!';
    }

    if (numChars >= text.length) {
        return text;
    }

    return text.substring(text.length - numChars);
}

/**
 * MID関数: 文字列の指定位置から指定文字数を取得
 * @param {Array} args - 評価済み引数 [文字列, 開始位置, 文字数]
 * @returns {string} 取得した文字列
 *
 * 使用例:
 * =MID("こんにちは", 2, 3)   - "んにち"
 * =MID("ABCDEF", 2, 3)       - "BCD"
 */
export function mid(args, rawArgs, context) {
    if (args.length < 3) {
        return '#VALUE!';
    }

    const text = String(args[0] ?? '');
    const startNum = toNumber(args[1]);
    const numChars = toNumber(args[2]);

    if (startNum === null || startNum < 1) {
        return '#VALUE!';
    }

    if (numChars === null || numChars < 0) {
        return '#VALUE!';
    }

    return text.substring(startNum - 1, startNum - 1 + numChars);
}

/**
 * LEN関数: 文字列の文字数を返す
 * @param {Array} args - 評価済み引数 [文字列]
 * @returns {number} 文字数
 *
 * 使用例:
 * =LEN("こんにちは")   - 5
 * =LEN("ABC")          - 3
 */
export function len(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const text = String(args[0] ?? '');
    return text.length;
}

/**
 * CONCATENATE関数: 複数の文字列を連結
 * @param {Array} args - 評価済み引数 [文字列1, 文字列2, ...]
 * @returns {string} 連結した文字列
 *
 * 使用例:
 * =CONCATENATE("Hello", " ", "World")   - "Hello World"
 * =CONCATENATE(A1, "-", B1)             - A1とB1を"-"で連結
 */
export function concatenate(args, rawArgs, context) {
    let result = '';

    for (const arg of args) {
        if (isErrorValue(arg)) {
            return arg;
        }
        result += String(arg ?? '');
    }

    return result;
}

/**
 * CONCAT関数: CONCATENATE の別名
 */
export function concat(args, rawArgs, context) {
    return concatenate(args, rawArgs, context);
}

/**
 * TRIM関数: 文字列の前後および連続する空白を削除
 * @param {Array} args - 評価済み引数 [文字列]
 * @returns {string} 空白を削除した文字列
 *
 * 使用例:
 * =TRIM("  Hello   World  ")   - "Hello World"
 */
export function trim(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const text = String(args[0] ?? '');
    // 前後の空白を削除し、連続する空白を1つにする
    return text.trim().replace(/\s+/g, ' ');
}

/**
 * UPPER関数: 文字列を大文字に変換
 * @param {Array} args - 評価済み引数 [文字列]
 * @returns {string} 大文字の文字列
 *
 * 使用例:
 * =UPPER("hello")   - "HELLO"
 */
export function upper(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const text = String(args[0] ?? '');
    return text.toUpperCase();
}

/**
 * LOWER関数: 文字列を小文字に変換
 * @param {Array} args - 評価済み引数 [文字列]
 * @returns {string} 小文字の文字列
 *
 * 使用例:
 * =LOWER("HELLO")   - "hello"
 */
export function lower(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const text = String(args[0] ?? '');
    return text.toLowerCase();
}

/**
 * PROPER関数: 各単語の先頭を大文字に変換
 * @param {Array} args - 評価済み引数 [文字列]
 * @returns {string} 各単語の先頭が大文字の文字列
 *
 * 使用例:
 * =PROPER("hello world")   - "Hello World"
 */
export function proper(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const text = String(args[0] ?? '');
    return text.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * FIND関数: 文字列内で別の文字列を検索（大文字小文字を区別）
 * @param {Array} args - 評価済み引数 [検索文字列, 対象文字列, [開始位置]]
 * @returns {number|string} 位置またはエラー
 *
 * 使用例:
 * =FIND("B", "ABCABC")     - 2
 * =FIND("B", "ABCABC", 3)  - 5
 */
export function find(args, rawArgs, context) {
    if (args.length < 2) {
        return '#VALUE!';
    }

    const findText = String(args[0] ?? '');
    const withinText = String(args[1] ?? '');
    const startNum = args.length >= 3 ? toNumber(args[2]) : 1;

    if (startNum === null || startNum < 1) {
        return '#VALUE!';
    }

    if (startNum > withinText.length) {
        return '#VALUE!';
    }

    const position = withinText.indexOf(findText, startNum - 1);

    if (position === -1) {
        return '#VALUE!';
    }

    return position + 1;
}

/**
 * SEARCH関数: 文字列内で別の文字列を検索（大文字小文字を区別しない）
 * @param {Array} args - 評価済み引数 [検索文字列, 対象文字列, [開始位置]]
 * @returns {number|string} 位置またはエラー
 *
 * 使用例:
 * =SEARCH("b", "ABCABC")     - 2
 * =SEARCH("B", "abcabc", 3)  - 5
 */
export function search(args, rawArgs, context) {
    if (args.length < 2) {
        return '#VALUE!';
    }

    const findText = String(args[0] ?? '').toLowerCase();
    const withinText = String(args[1] ?? '').toLowerCase();
    const startNum = args.length >= 3 ? toNumber(args[2]) : 1;

    if (startNum === null || startNum < 1) {
        return '#VALUE!';
    }

    if (startNum > withinText.length) {
        return '#VALUE!';
    }

    // ワイルドカード対応（* と ?）
    let searchPattern = findText;
    if (findText.includes('*') || findText.includes('?')) {
        searchPattern = findText
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');

        try {
            const regex = new RegExp(searchPattern, 'i');
            const match = withinText.substring(startNum - 1).match(regex);
            if (match) {
                return startNum + match.index;
            }
            return '#VALUE!';
        } catch (e) {
            return '#VALUE!';
        }
    }

    const position = withinText.indexOf(findText, startNum - 1);

    if (position === -1) {
        return '#VALUE!';
    }

    return position + 1;
}

/**
 * SUBSTITUTE関数: 文字列内の指定テキストを置換
 * @param {Array} args - 評価済み引数 [文字列, 検索文字列, 置換文字列, [置換対象]]
 * @returns {string} 置換後の文字列
 *
 * 使用例:
 * =SUBSTITUTE("ABC ABC", "ABC", "XYZ")      - "XYZ XYZ"
 * =SUBSTITUTE("ABC ABC", "ABC", "XYZ", 2)   - "ABC XYZ"（2番目のみ置換）
 */
export function substitute(args, rawArgs, context) {
    if (args.length < 3) {
        return '#VALUE!';
    }

    const text = String(args[0] ?? '');
    const oldText = String(args[1] ?? '');
    const newText = String(args[2] ?? '');
    const instanceNum = args.length >= 4 ? toNumber(args[3]) : null;

    if (oldText === '') {
        return text;
    }

    if (instanceNum !== null) {
        if (instanceNum < 1) {
            return '#VALUE!';
        }

        // 指定された出現回数のみ置換
        let count = 0;
        let result = '';
        let lastIndex = 0;
        let index = text.indexOf(oldText);

        while (index !== -1) {
            count++;
            if (count === instanceNum) {
                result = text.substring(0, index) + newText + text.substring(index + oldText.length);
                return result;
            }
            lastIndex = index + 1;
            index = text.indexOf(oldText, lastIndex);
        }

        return text; // 指定の出現回数がない場合は元の文字列を返す
    }

    // すべて置換
    return text.split(oldText).join(newText);
}

/**
 * REPLACE関数: 文字列の指定位置から指定文字数を置換
 * @param {Array} args - 評価済み引数 [文字列, 開始位置, 文字数, 新しい文字列]
 * @returns {string} 置換後の文字列
 *
 * 使用例:
 * =REPLACE("ABCDEF", 3, 2, "XYZ")   - "ABXYZEF"
 */
export function replace(args, rawArgs, context) {
    if (args.length < 4) {
        return '#VALUE!';
    }

    const oldText = String(args[0] ?? '');
    const startNum = toNumber(args[1]);
    const numChars = toNumber(args[2]);
    const newText = String(args[3] ?? '');

    if (startNum === null || startNum < 1) {
        return '#VALUE!';
    }

    if (numChars === null || numChars < 0) {
        return '#VALUE!';
    }

    return oldText.substring(0, startNum - 1) + newText + oldText.substring(startNum - 1 + numChars);
}

/**
 * REPT関数: 文字列を指定回数繰り返す
 * @param {Array} args - 評価済み引数 [文字列, 回数]
 * @returns {string} 繰り返した文字列
 *
 * 使用例:
 * =REPT("AB", 3)   - "ABABAB"
 */
export function rept(args, rawArgs, context) {
    if (args.length < 2) {
        return '#VALUE!';
    }

    const text = String(args[0] ?? '');
    const numTimes = toNumber(args[1]);

    if (numTimes === null || numTimes < 0) {
        return '#VALUE!';
    }

    return text.repeat(Math.floor(numTimes));
}

/**
 * TEXT関数: 数値を書式付き文字列に変換
 * @param {Array} args - 評価済み引数 [値, 書式]
 * @returns {string} 書式化された文字列
 *
 * 使用例:
 * =TEXT(1234.5, "0.00")       - "1234.50"
 * =TEXT(0.25, "0%")           - "25%"
 * =TEXT(1234, "#,##0")        - "1,234"
 */
export function text(args, rawArgs, context) {
    if (args.length < 2) {
        return '#VALUE!';
    }

    const value = args[0];
    const formatStr = String(args[1] ?? '');

    if (isErrorValue(value)) {
        return value;
    }

    const num = toNumber(value);

    if (num === null) {
        return String(value ?? '');
    }

    // 簡易的な書式処理
    // パーセント
    if (formatStr.includes('%')) {
        const decimals = (formatStr.match(/0+(?=%)/)?.[0]?.length || 0);
        return (num * 100).toFixed(decimals) + '%';
    }

    // 小数点
    const decimalMatch = formatStr.match(/\.([0#]+)/);
    const decimals = decimalMatch ? decimalMatch[1].replace(/#/g, '').length : 0;

    // 桁区切り
    const hasThousandsSep = formatStr.includes(',');

    let result = num.toFixed(decimals);

    if (hasThousandsSep) {
        const parts = result.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        result = parts.join('.');
    }

    return result;
}

/**
 * VALUE関数: 文字列を数値に変換
 * @param {Array} args - 評価済み引数 [文字列]
 * @returns {number|string} 数値またはエラー
 *
 * 使用例:
 * =VALUE("123.45")   - 123.45
 * =VALUE("$100")     - 100
 */
export function value(args, rawArgs, context) {
    if (args.length < 1) {
        return '#VALUE!';
    }

    const text = String(args[0] ?? '');

    // 通貨記号や桁区切りを除去
    const cleaned = text
        .replace(/[$¥€£,]/g, '')
        .replace(/\s/g, '')
        .replace(/%$/, '');

    const num = parseFloat(cleaned);

    if (isNaN(num)) {
        return '#VALUE!';
    }

    // パーセントの場合
    if (text.endsWith('%')) {
        return num / 100;
    }

    return num;
}

/**
 * EXACT関数: 2つの文字列が完全に一致するか判定
 * @param {Array} args - 評価済み引数 [文字列1, 文字列2]
 * @returns {boolean} 一致する場合はtrue
 *
 * 使用例:
 * =EXACT("ABC", "ABC")   - TRUE
 * =EXACT("ABC", "abc")   - FALSE
 */
export function exact(args, rawArgs, context) {
    if (args.length < 2) {
        return '#VALUE!';
    }

    const text1 = String(args[0] ?? '');
    const text2 = String(args[1] ?? '');

    return text1 === text2;
}
