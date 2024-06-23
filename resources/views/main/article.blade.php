@extends('layouts.app')

@section('head')
<style>
    .code-block {
        background-color: #2d2d2d;
        color: #f8f8f2;
        font-family: 'Courier New', Courier, monospace;
        white-space: pre-wrap; /* 改行を保持 */
        border-radius: 5px;
        padding: 1em;
        line-height: 0.8;
    }
    .container h1 {
        font-weight: bold !important;
        font-size: 2rem !important;
        color: #333 !important; /* 必要に応じて追加 */
    }
    .explanation a {
        color: #007bff;
        text-decoration: underline;
    }
    .explanation a:hover {
        color: #0056b3;
        text-decoration: none;
    }
    .dropdown-menu-right {
        right: 0;
        left: auto;
    }
    .custom-context-menu {
        display: none;
        position: absolute;
        background-color: #f8f9fa; /* 明るい背景色 */
        border-radius: 8px; /* 角丸 */
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); /* 柔らかい影 */
        z-index: 1000;
        width: 200px; /* メニューを広く */
    }
    .custom-context-menu div {
        padding: 12px 20px; /* 広めのパディング */
        color: #333;
        text-decoration: none;
        border-bottom: 1px solid #e9ecef; /* 優しいボーダー */
    }
    .custom-context-menu div:last-child {
        border-bottom: none; /* 最後の要素のボーダーを削除 */
    }
    .custom-context-menu div:hover {
        background-color: #e2e6ea; /* 優しいホバー色 */
    }
    .update-button {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: none;
    }
</style>
@endsection

@section('content')
<div class="container my-5">
    <div class="d-flex justify-content-between">
        <h1 id="article-title">{{ $article->title }}</h1>
    </div>

    @if ($article->code)
        <div class="my-4">
            <h5>コード:</h5>
            <pre class="code-block p-3" id="article-code">{{ $article->code }}</pre>
        </div>
    @else
        @auth
        @if (Auth::user()->authority === 'maru')
        <textarea id="edit-code" class="form-control" rows="10" style="display: none;"></textarea>
        @endif
        @endauth
    @endif

    <div class="my-4">
        <div class="explanation" id="article-explanation">{!! nl2br($article->explanation) !!}</div>
    </div>
</div>

@auth
    @if (Auth::user()->authority === 'maru')
    <div class="custom-context-menu" id="contextMenu">
        <div id="menu-edit">編集</div>
        <div id="menu-delete">削除</div>
    </div>
    <button id="update-button" class="btn btn-primary update-button">更新</button>
    @endif
@endauth

@endsection

@auth
    @if (Auth::user()->authority === 'maru')
        @section('Javascript')
<script>
    document.addEventListener('DOMContentLoaded', function() {
        const contextMenu = document.getElementById('contextMenu');
        const updateButton = document.getElementById('update-button');

        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            contextMenu.style.display = 'block';
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.style.left = `${e.clientX}px`;
        });

        document.addEventListener('click', function(e) {
            if (!contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });

        document.getElementById('menu-edit').addEventListener('click', function() {
            contextMenu.style.display = 'none';

            const titleElement = document.getElementById('article-title');
            const codeElement = document.getElementById('article-code');
            const explanationElement = document.getElementById('article-explanation');

            // タイトルを編集可能にする
            titleElement.innerHTML = `<input type="text" id="edit-title" value="${titleElement.textContent.trim()}" class="form-control"/>`;

            if (codeElement) {
                const codeText = codeElement.textContent.trim();
                codeElement.innerHTML = `<textarea id="edit-code" class="form-control" rows="10">${codeText}</textarea>`;
            } else {
                document.getElementById('edit-code').style.display = 'block';
            }

            // 説明を編集可能にする（HTMLタグをエスケープして表示）
            const explanationHTML = explanationElement.innerHTML
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'");
            
            explanationElement.innerHTML = `<textarea id="edit-explanation" class="form-control" rows="10">${explanationHTML}</textarea>`;

            // 更新ボタンを表示
            updateButton.style.display = 'block';
        });

        updateButton.addEventListener('click', function() {
            const id = {{ $article->id }};
            const title = document.getElementById('edit-title').value;
            const code = document.getElementById('edit-code').value;
            const explanation = document.getElementById('edit-explanation').value.replace(/\n/g, '<br>');

            fetch(`/article/update/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': '{{ csrf_token() }}'
                },
                body: JSON.stringify({
                    title: title,
                    code: code,
                    explanation: explanation
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // 更新ボタンを非表示にする
                    updateButton.style.display = 'none';
                    // 更新後の処理（例：ページのリロードなど）
                    location.reload();
                } else {
                    alert('更新に失敗しました');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('更新に失敗しました');
            });
        });

        document.getElementById('menu-delete').addEventListener('click', function() {
            contextMenu.style.display = 'none';
            if (confirm('本当に削除しますか？')) {
                // 削除処理を実行する関数を呼び出す
                // deleteArticle();
            }
        });
    });
</script>
        @endsection
    @endif
@endauth
