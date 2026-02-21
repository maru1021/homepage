/**
 * DKCドライブ - 数式入力補助モジュール
 * 数式入力時のセル参照挿入・ハイライト機能・オートコンプリート
 */

// ハイライト用カラークラス（6色）
const REF_COLORS = [
    'formula-ref-1', 'formula-ref-2', 'formula-ref-3',
    'formula-ref-4', 'formula-ref-5', 'formula-ref-6'
];

// セル参照の終端文字パターン
const FORMULA_OPERATOR_PATTERN = /[+\-*/^%,(<>=]$/;

// セル参照抽出パターン（A1, $A$1, A1:B2 等）
const CELL_REF_PATTERN = /\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?/gi;

// 関数定義（名前、構文、説明）
const FORMULA_FUNCTIONS = [
    // 合計・平均
    { name: 'SUM', syntax: 'SUM(数値1, [数値2], ...)', description: '指定した範囲の数値を合計します', args: ['数値1', '数値2', '...'] },
    { name: 'SUMIF', syntax: 'SUMIF(範囲, 条件, [合計範囲])', description: '条件に一致するセルの値を合計します', args: ['範囲', '条件', '合計範囲'] },
    { name: 'SUMIFS', syntax: 'SUMIFS(合計範囲, 条件範囲1, 条件1, ...)', description: '複数の条件に一致するセルの値を合計します', args: ['合計範囲', '条件範囲1', '条件1', '...'] },
    { name: 'AVERAGE', syntax: 'AVERAGE(数値1, [数値2], ...)', description: '引数の平均値を計算します', args: ['数値1', '数値2', '...'] },
    { name: 'AVERAGEIF', syntax: 'AVERAGEIF(範囲, 条件, [平均範囲])', description: '条件に一致するセルの平均値を計算します', args: ['範囲', '条件', '平均範囲'] },
    { name: 'AVERAGEIFS', syntax: 'AVERAGEIFS(平均範囲, 条件範囲1, 条件1, ...)', description: '複数の条件に一致するセルの平均値を計算します', args: ['平均範囲', '条件範囲1', '条件1', '...'] },
    // カウント
    { name: 'COUNT', syntax: 'COUNT(値1, [値2], ...)', description: '数値を含むセルの個数を数えます', args: ['値1', '値2', '...'] },
    { name: 'COUNTA', syntax: 'COUNTA(値1, [値2], ...)', description: '空でないセルの個数を数えます', args: ['値1', '値2', '...'] },
    { name: 'COUNTBLANK', syntax: 'COUNTBLANK(範囲)', description: '空のセルの個数を数えます', args: ['範囲'] },
    { name: 'COUNTIF', syntax: 'COUNTIF(範囲, 条件)', description: '条件に一致するセルの個数を数えます', args: ['範囲', '条件'] },
    { name: 'COUNTIFS', syntax: 'COUNTIFS(条件範囲1, 条件1, ...)', description: '複数の条件に一致するセルの個数を数えます', args: ['条件範囲1', '条件1', '...'] },
    // 最大・最小
    { name: 'MAX', syntax: 'MAX(数値1, [数値2], ...)', description: '引数の最大値を返します', args: ['数値1', '数値2', '...'] },
    { name: 'MIN', syntax: 'MIN(数値1, [数値2], ...)', description: '引数の最小値を返します', args: ['数値1', '数値2', '...'] },
    // 丸め
    { name: 'ROUND', syntax: 'ROUND(数値, 桁数)', description: '数値を指定した桁数に四捨五入します', args: ['数値', '桁数'] },
    { name: 'ROUNDUP', syntax: 'ROUNDUP(数値, 桁数)', description: '数値を指定した桁数に切り上げます', args: ['数値', '桁数'] },
    { name: 'ROUNDDOWN', syntax: 'ROUNDDOWN(数値, 桁数)', description: '数値を指定した桁数に切り捨てます', args: ['数値', '桁数'] },
    // 数学
    { name: 'ABS', syntax: 'ABS(数値)', description: '数値の絶対値を返します', args: ['数値'] },
    { name: 'INT', syntax: 'INT(数値)', description: '数値の整数部分を返します', args: ['数値'] },
    { name: 'MOD', syntax: 'MOD(数値, 除数)', description: '除算の余りを返します', args: ['数値', '除数'] },
    { name: 'POWER', syntax: 'POWER(底, 指数)', description: 'べき乗を計算します', args: ['底', '指数'] },
    { name: 'SQRT', syntax: 'SQRT(数値)', description: '平方根を返します', args: ['数値'] },
    // 条件
    { name: 'IF', syntax: 'IF(条件, 真の場合, 偽の場合)', description: '条件が真か偽かを判定し、対応する値を返します', args: ['条件', '真の場合', '偽の場合'] },
    // 検索・参照
    { name: 'VLOOKUP', syntax: 'VLOOKUP(検索値, 範囲, 列番号, [近似一致])', description: '範囲の左端列を検索し、指定列の値を返します', args: ['検索値', '範囲', '列番号', '近似一致'] },
    { name: 'HLOOKUP', syntax: 'HLOOKUP(検索値, 範囲, 行番号, [近似一致])', description: '範囲の上端行を検索し、指定行の値を返します', args: ['検索値', '範囲', '行番号', '近似一致'] },
    { name: 'INDEX', syntax: 'INDEX(範囲, 行番号, [列番号])', description: '範囲から指定位置の値を返します', args: ['範囲', '行番号', '列番号'] },
    { name: 'MATCH', syntax: 'MATCH(検索値, 範囲, [照合の型])', description: '検索値の位置を返します', args: ['検索値', '範囲', '照合の型'] },
    // 文字列
    { name: 'LEFT', syntax: 'LEFT(文字列, [文字数])', description: '文字列の左から指定した文字数を取得します', args: ['文字列', '文字数'] },
    { name: 'RIGHT', syntax: 'RIGHT(文字列, [文字数])', description: '文字列の右から指定した文字数を取得します', args: ['文字列', '文字数'] },
    { name: 'MID', syntax: 'MID(文字列, 開始位置, 文字数)', description: '文字列の指定位置から指定文字数を取得します', args: ['文字列', '開始位置', '文字数'] },
    { name: 'LEN', syntax: 'LEN(文字列)', description: '文字列の文字数を返します', args: ['文字列'] },
    { name: 'CONCATENATE', syntax: 'CONCATENATE(文字列1, [文字列2], ...)', description: '複数の文字列を連結します', args: ['文字列1', '文字列2', '...'] },
    { name: 'CONCAT', syntax: 'CONCAT(文字列1, [文字列2], ...)', description: '複数の文字列を連結します', args: ['文字列1', '文字列2', '...'] },
    { name: 'TRIM', syntax: 'TRIM(文字列)', description: '文字列の前後と連続する空白を削除します', args: ['文字列'] },
    { name: 'UPPER', syntax: 'UPPER(文字列)', description: '文字列を大文字に変換します', args: ['文字列'] },
    { name: 'LOWER', syntax: 'LOWER(文字列)', description: '文字列を小文字に変換します', args: ['文字列'] },
    { name: 'PROPER', syntax: 'PROPER(文字列)', description: '各単語の先頭を大文字に変換します', args: ['文字列'] },
    { name: 'FIND', syntax: 'FIND(検索文字列, 対象文字列, [開始位置])', description: '文字列内で別の文字列を検索します（大文字小文字を区別）', args: ['検索文字列', '対象文字列', '開始位置'] },
    { name: 'SEARCH', syntax: 'SEARCH(検索文字列, 対象文字列, [開始位置])', description: '文字列内で別の文字列を検索します（大文字小文字を区別しない）', args: ['検索文字列', '対象文字列', '開始位置'] },
    { name: 'SUBSTITUTE', syntax: 'SUBSTITUTE(文字列, 検索文字列, 置換文字列, [置換対象])', description: '文字列内の指定テキストを置換します', args: ['文字列', '検索文字列', '置換文字列', '置換対象'] },
    { name: 'REPLACE', syntax: 'REPLACE(文字列, 開始位置, 文字数, 新しい文字列)', description: '文字列の指定位置から指定文字数を置換します', args: ['文字列', '開始位置', '文字数', '新しい文字列'] },
    { name: 'REPT', syntax: 'REPT(文字列, 回数)', description: '文字列を指定回数繰り返します', args: ['文字列', '回数'] },
    { name: 'TEXT', syntax: 'TEXT(値, 書式)', description: '数値を書式付き文字列に変換します', args: ['値', '書式'] },
    { name: 'VALUE', syntax: 'VALUE(文字列)', description: '文字列を数値に変換します', args: ['文字列'] },
    { name: 'EXACT', syntax: 'EXACT(文字列1, 文字列2)', description: '2つの文字列が完全に一致するか判定します', args: ['文字列1', '文字列2'] },
];

/**
 * 数式入力補助ミックスイン
 */
export const FormulaInputMixin = (Base) => class extends Base {

    // ===== ユーティリティ =====

    /** 現在アクティブな入力要素を取得 */
    _getActiveInput() {
        if (this.state.isFormulaBarFocused && this.elements.formulaInput) {
            return this.elements.formulaInput;
        }
        return this.state.editingCell?.querySelector('.cell-input') || null;
    }

    /** 現在の入力値を取得 */
    _getCurrentInputValue() {
        return this._getActiveInput()?.value || '';
    }

    /** 列名を列インデックスに変換 */
    _colNameToIndex(colStr) {
        let col = 0;
        for (const char of colStr) {
            col = col * 26 + (char.charCodeAt(0) - 64);
        }
        return col - 1;
    }

    /** 範囲を正規化 */
    _normalizeRange(start, end) {
        return {
            minRow: Math.min(start.row, end.row),
            maxRow: Math.max(start.row, end.row),
            minCol: Math.min(start.col, end.col),
            maxCol: Math.max(start.col, end.col)
        };
    }

    /** 範囲内の全セルに対して処理を実行 */
    _forEachCellInRange(range, callback) {
        for (let r = range.minRow; r <= range.maxRow; r++) {
            for (let c = range.minCol; c <= range.maxCol; c++) {
                const cell = this.getCell(r, c);
                if (cell) callback(cell, r, c);
            }
        }
    }

    /** セル参照文字列を生成 */
    _buildCellRef(row, col) {
        return this.getColumnName(col) + (row + 1);
    }

    /** 範囲参照文字列を生成 */
    _buildRangeRef(start, end) {
        const { minRow, maxRow, minCol, maxCol } = this._normalizeRange(start, end);
        if (minRow === maxRow && minCol === maxCol) {
            return this._buildCellRef(minRow, minCol);
        }
        return `${this._buildCellRef(minRow, minCol)}:${this._buildCellRef(maxRow, maxCol)}`;
    }

    /** 数式バーとセル入力を同期 */
    _syncInputs(sourceInput) {
        const { formulaInput } = this.elements;
        const cellInput = this.state.editingCell?.querySelector('.cell-input');

        if (sourceInput === formulaInput && cellInput) {
            cellInput.value = sourceInput.value;
        } else if (sourceInput === cellInput && formulaInput) {
            formulaInput.value = sourceInput.value;
        }
    }

    // ===== 入力モード判定 =====

    /** セル参照を挿入可能な状態か */
    isFormulaInputMode() {
        const value = this._getCurrentInputValue();
        if (!value.startsWith('=')) return false;
        return value === '=' || FORMULA_OPERATOR_PATTERN.test(value);
    }

    /** 数式編集中か */
    isEditingFormula() {
        return this._getCurrentInputValue().startsWith('=');
    }

    // ===== セル参照抽出 =====

    /** 数式からセル参照を抽出 */
    extractCellReferences(formula) {
        if (!formula?.startsWith('=')) return [];

        const refs = [];
        let match;
        CELL_REF_PATTERN.lastIndex = 0;

        while ((match = CELL_REF_PATTERN.exec(formula)) !== null) {
            const ref = {
                ref: match[0],
                row: parseInt(match[2]) - 1,
                col: this._colNameToIndex(match[1].toUpperCase()),
                isRange: !!(match[3] && match[4])
            };
            if (ref.isRange) {
                ref.endRow = parseInt(match[4]) - 1;
                ref.endCol = this._colNameToIndex(match[3].toUpperCase());
            }
            refs.push(ref);
        }
        return refs;
    }

    // ===== ハイライト =====

    /** 全ハイライトをクリア */
    clearFormulaHighlights() {
        if (!this.elements.spreadsheet) return;
        this.elements.spreadsheet.querySelectorAll('td.formula-ref-current,' + REF_COLORS.map(c => `td.${c}`).join(','))
            .forEach(cell => {
                cell.classList.remove('formula-ref-current', ...REF_COLORS);
            });
    }

    /** 数式内の参照セルをハイライト */
    highlightFormulaReferences(formula) {
        this.clearFormulaHighlights();
        if (!formula?.startsWith('=')) return;

        this.extractCellReferences(formula).forEach((ref, index) => {
            const colorClass = REF_COLORS[index % REF_COLORS.length];
            if (ref.isRange) {
                this._forEachCellInRange(
                    this._normalizeRange({ row: ref.row, col: ref.col }, { row: ref.endRow, col: ref.endCol }),
                    cell => cell.classList.add(colorClass)
                );
            } else {
                this.getCell(ref.row, ref.col)?.classList.add(colorClass);
            }
        });
    }

    /** 現在選択中のセルをハイライト */
    highlightCurrentFormulaRef(row, col) {
        this.elements.spreadsheet?.querySelectorAll('td.formula-ref-current')
            .forEach(cell => cell.classList.remove('formula-ref-current'));
        this.getCell(row, col)?.classList.add('formula-ref-current');
    }

    /** 現在選択中の範囲をハイライト */
    highlightFormulaRangeSelection(start, end) {
        this.elements.spreadsheet?.querySelectorAll('td.formula-ref-current')
            .forEach(cell => cell.classList.remove('formula-ref-current'));
        this._forEachCellInRange(this._normalizeRange(start, end), cell => cell.classList.add('formula-ref-current'));
    }

    // ===== セル参照挿入 =====

    /** セル参照を数式に挿入 */
    insertCellReference(row, col) {
        const input = this._getActiveInput();
        if (!input) return;

        const cellRef = this._buildCellRef(row, col);
        const { selectionStart, selectionEnd, value } = input;

        this.state.formulaRefStart = selectionStart;
        this.state.formulaRefEnd = selectionStart + cellRef.length;

        input.value = value.substring(0, selectionStart) + cellRef + value.substring(selectionEnd);
        input.focus();
        input.setSelectionRange(this.state.formulaRefEnd, this.state.formulaRefEnd);
        this._syncInputs(input);
    }

    /** 列参照を数式に挿入（例：A:A） */
    insertColumnReference(col) {
        const input = this._getActiveInput();
        if (!input) return;

        const colName = this.getColumnName(col);
        const colRef = `${colName}:${colName}`;
        const { selectionStart, selectionEnd, value } = input;

        this.state.formulaRefStart = selectionStart;
        this.state.formulaRefEnd = selectionStart + colRef.length;

        input.value = value.substring(0, selectionStart) + colRef + value.substring(selectionEnd);
        input.focus();
        input.setSelectionRange(this.state.formulaRefEnd, this.state.formulaRefEnd);
        this._syncInputs(input);
    }

    /** 行参照を数式に挿入（例：1:1） */
    insertRowReference(row) {
        const input = this._getActiveInput();
        if (!input) return;

        const rowNum = row + 1;
        const rowRef = `${rowNum}:${rowNum}`;
        const { selectionStart, selectionEnd, value } = input;

        this.state.formulaRefStart = selectionStart;
        this.state.formulaRefEnd = selectionStart + rowRef.length;

        input.value = value.substring(0, selectionStart) + rowRef + value.substring(selectionEnd);
        input.focus();
        input.setSelectionRange(this.state.formulaRefEnd, this.state.formulaRefEnd);
        this._syncInputs(input);
    }

    /** 列範囲参照を更新（例：A:C） */
    updateColumnRangeReference(startCol, endCol) {
        const input = this._getActiveInput();
        if (!input) return;

        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);
        const colRef = `${this.getColumnName(minCol)}:${this.getColumnName(maxCol)}`;
        const { formulaRefStart } = this.state;
        const { value } = input;

        input.value = value.substring(0, formulaRefStart) + colRef + value.substring(this.state.formulaRefEnd);
        this.state.formulaRefEnd = formulaRefStart + colRef.length;

        input.focus();
        input.setSelectionRange(this.state.formulaRefEnd, this.state.formulaRefEnd);
        this._syncInputs(input);
    }

    /** 行範囲参照を更新（例：1:5） */
    updateRowRangeReference(startRow, endRow) {
        const input = this._getActiveInput();
        if (!input) return;

        const minRow = Math.min(startRow, endRow) + 1;
        const maxRow = Math.max(startRow, endRow) + 1;
        const rowRef = `${minRow}:${maxRow}`;
        const { formulaRefStart } = this.state;
        const { value } = input;

        input.value = value.substring(0, formulaRefStart) + rowRef + value.substring(this.state.formulaRefEnd);
        this.state.formulaRefEnd = formulaRefStart + rowRef.length;

        input.focus();
        input.setSelectionRange(this.state.formulaRefEnd, this.state.formulaRefEnd);
        this._syncInputs(input);
    }

    /** 数式の範囲参照を更新 */
    updateFormulaRangeReference(start, end) {
        const input = this._getActiveInput();
        if (!input) return;

        const cellRef = this._buildRangeRef(start, end);
        const { formulaRefStart } = this.state;
        const { value } = input;

        input.value = value.substring(0, formulaRefStart) + cellRef + value.substring(this.state.formulaRefEnd);
        this.state.formulaRefEnd = formulaRefStart + cellRef.length;

        input.focus();
        input.setSelectionRange(this.state.formulaRefEnd, this.state.formulaRefEnd);
        this._syncInputs(input);
    }

    // ===== オートコンプリート・数式ヒント =====

    /** オートコンプリートの初期化 */
    initFormulaAutocomplete() {
        this.state.autocomplete = {
            visible: false,
            selectedIndex: 0,
            matches: [],
            currentFunction: null,
            currentArgIndex: 0
        };

        const formulaInput = this.elements.formulaInput;
        if (formulaInput) {
            formulaInput.addEventListener('input', () => this._handleFormulaInput());
            formulaInput.addEventListener('keydown', (e) => this._handleAutocompleteKeydown(e));
            formulaInput.addEventListener('blur', () => setTimeout(() => this.closeFormulaAssist(), 150));
        }
    }

    /**
     * 数式補助をすべて閉じる（オートコンプリート・ヒント・ハイライト）
     * Enter/Tab/Escape/blur 時に呼び出す
     */
    closeFormulaAssist() {
        this._hideAutocomplete();
        this._hideFormulaHint();
        this.clearFormulaHighlights();
    }

    /** 数式入力時の処理 */
    _handleFormulaInput() {
        const value = this._getCurrentInputValue();

        if (!value.startsWith('=')) {
            this._hideAutocomplete();
            this._hideFormulaHint();
            return;
        }

        const funcMatch = this._detectFunctionInput(value);

        if (funcMatch.isTypingFunctionName) {
            this._showAutocomplete(funcMatch.partial);
        } else if (funcMatch.insideFunction) {
            this._hideAutocomplete();
            this._showFormulaHint(funcMatch.functionName, funcMatch.argIndex);
        } else {
            this._hideAutocomplete();
            this._hideFormulaHint();
        }
    }

    /** 入力中の関数を検出 */
    _detectFunctionInput(value) {
        const formula = value.substring(1);
        const cursorPos = this._getActiveInput()?.selectionStart - 1 || formula.length;
        const beforeCursor = formula.substring(0, cursorPos);

        // 関数名入力中かチェック
        const funcNameMatch = beforeCursor.match(/([A-Z]+)$/i);
        if (funcNameMatch && !beforeCursor.includes('(')) {
            return { isTypingFunctionName: true, partial: funcNameMatch[1].toUpperCase(), insideFunction: false };
        }

        // 演算子の後で関数名入力中かチェック
        const afterOperatorMatch = beforeCursor.match(/[+\-*/^%,(]([A-Z]+)$/i);
        if (afterOperatorMatch) {
            return { isTypingFunctionName: true, partial: afterOperatorMatch[1].toUpperCase(), insideFunction: false };
        }

        // 関数の括弧内にいるかチェック
        const funcInfo = this._findCurrentFunction(beforeCursor);
        if (funcInfo) {
            return { isTypingFunctionName: false, insideFunction: true, functionName: funcInfo.name, argIndex: funcInfo.argIndex };
        }

        return { isTypingFunctionName: false, insideFunction: false };
    }

    /** 現在カーソルがある関数を特定 */
    _findCurrentFunction(beforeCursor) {
        let parenDepth = 0, funcStart = -1, argIndex = 0;

        for (let i = beforeCursor.length - 1; i >= 0; i--) {
            const char = beforeCursor[i];
            if (char === ')') parenDepth++;
            else if (char === '(') {
                if (parenDepth === 0) { funcStart = i; break; }
                parenDepth--;
            } else if (char === ',' && parenDepth === 0) argIndex++;
        }

        if (funcStart <= 0) return null;

        const funcNameMatch = beforeCursor.substring(0, funcStart).match(/([A-Z]+)$/i);
        if (!funcNameMatch) return null;

        const funcName = funcNameMatch[1].toUpperCase();
        const funcDef = FORMULA_FUNCTIONS.find(f => f.name === funcName);
        return funcDef ? { name: funcName, argIndex, funcDef } : null;
    }

    /** オートコンプリートを表示 */
    _showAutocomplete(partial) {
        const matches = FORMULA_FUNCTIONS.filter(f => f.name.startsWith(partial));

        if (matches.length === 0) {
            this._hideAutocomplete();
            return;
        }

        this.state.autocomplete.matches = matches;
        this.state.autocomplete.selectedIndex = 0;
        this.state.autocomplete.visible = true;

        const container = document.getElementById('formula-autocomplete');
        const list = document.getElementById('formula-autocomplete-list');
        if (!container || !list) return;

        list.innerHTML = matches.map((func, i) => `
            <div class="formula-autocomplete-item ${i === 0 ? 'selected' : ''}" data-index="${i}">
                <div class="formula-autocomplete-name"><span class="func-icon">fx</span> ${func.name}</div>
                <div class="formula-autocomplete-syntax">${func.syntax}</div>
                <div class="formula-autocomplete-desc">${func.description}</div>
            </div>
        `).join('');

        list.querySelectorAll('.formula-autocomplete-item').forEach(item => {
            item.addEventListener('click', () => this._selectAutocompleteItem(+item.dataset.index));
        });

        container.style.display = 'block';
    }

    /** オートコンプリートを非表示 */
    _hideAutocomplete() {
        if (this.state.autocomplete) this.state.autocomplete.visible = false;
        document.getElementById('formula-autocomplete')?.style.setProperty('display', 'none');
    }

    /** オートコンプリートのキーボード操作 */
    _handleAutocompleteKeydown(e) {
        if (!this.state.autocomplete?.visible) return;

        const { matches, selectedIndex } = this.state.autocomplete;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this._updateAutocompleteSelection((selectedIndex + 1) % matches.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this._updateAutocompleteSelection((selectedIndex - 1 + matches.length) % matches.length);
                break;
            case 'Tab':
            case 'Enter':
                if (matches.length > 0) {
                    e.preventDefault();
                    this._selectAutocompleteItem(selectedIndex);
                }
                break;
            case 'Escape':
                e.preventDefault();
                this._hideAutocomplete();
                break;
        }
    }

    /** オートコンプリートの選択を更新 */
    _updateAutocompleteSelection(newIndex) {
        this.state.autocomplete.selectedIndex = newIndex;
        const list = document.getElementById('formula-autocomplete-list');
        if (!list) return;

        list.querySelectorAll('.formula-autocomplete-item').forEach((item, i) => {
            item.classList.toggle('selected', i === newIndex);
        });
        list.querySelector('.formula-autocomplete-item.selected')?.scrollIntoView({ block: 'nearest' });
    }

    /** オートコンプリート項目を選択 */
    _selectAutocompleteItem(index) {
        const func = this.state.autocomplete.matches[index];
        if (!func) return;

        const input = this._getActiveInput();
        if (!input) return;

        const { value, selectionStart: cursorPos } = input;
        const funcMatch = value.substring(0, cursorPos).match(/([A-Z]+)$/i);
        if (!funcMatch) return;

        const replaceStart = cursorPos - funcMatch[1].length;
        input.value = value.substring(0, replaceStart) + func.name + '(' + value.substring(cursorPos);

        const newCursorPos = replaceStart + func.name.length + 1;
        input.setSelectionRange(newCursorPos, newCursorPos);
        input.focus();

        this._syncInputs(input);
        this._hideAutocomplete();
        this._showFormulaHint(func.name, 0);
    }

    /** 関数ヒントを表示 */
    _showFormulaHint(funcName, argIndex) {
        const func = FORMULA_FUNCTIONS.find(f => f.name === funcName);
        if (!func) {
            this._hideFormulaHint();
            return;
        }

        this.state.autocomplete.currentFunction = func;
        this.state.autocomplete.currentArgIndex = argIndex;
        this._hideFormulaHint();

        // 引数をハイライト表示
        const match = func.syntax.match(/\((.+)\)/);
        let syntaxHtml = func.syntax;
        if (match) {
            const funcNamePart = func.syntax.split('(')[0];
            const args = this._splitArgs(match[1]);
            const highlighted = args.map((arg, i) => i === argIndex ? `<span class="current-arg">${arg}</span>` : arg);
            syntaxHtml = `${funcNamePart}(${highlighted.join(', ')})`;
        }

        const hint = document.createElement('div');
        hint.className = 'formula-hint';
        hint.id = 'formula-hint';
        hint.innerHTML = `
            <div class="formula-hint-name">${func.name}</div>
            <div class="formula-hint-syntax">${syntaxHtml}</div>
            <div class="formula-hint-desc">${func.description}</div>
        `;

        document.querySelector('.formula-bar-wrapper')?.appendChild(hint);
    }

    /** 引数文字列を分割 */
    _splitArgs(argsStr) {
        const args = [];
        let current = '', depth = 0;

        for (const char of argsStr) {
            if (char === '[') depth++;
            else if (char === ']') depth--;
            else if (char === ',' && depth === 0) {
                args.push(current.trim());
                current = '';
                continue;
            }
            current += char;
        }
        if (current.trim()) args.push(current.trim());
        return args;
    }

    /** 関数ヒントを非表示 */
    _hideFormulaHint() {
        document.getElementById('formula-hint')?.remove();
        if (this.state.autocomplete) this.state.autocomplete.currentFunction = null;
    }
};
