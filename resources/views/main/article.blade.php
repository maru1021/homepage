@extends('layouts.app')

@section('head')
<style>
    .code-block {
        background-color: #2d2d2d;
        color: #f8f8f2;
        font-family: 'Courier New', Courier, monospace;
        white-space: pre-wrap;
        border-radius: 5px;
        padding: 1em;
        line-height: 1.0;
        margin-top: 0;
    }
    .nav-tabs {
        margin-bottom: 0;
    }
    .container h1 {
        font-weight: bold !important;
        font-size: 2rem !important;
        color: #333 !important;
    }
    .explanation h2 {
        font-weight: bold !important;
        font-size: 1.2rem !important;
        color: #333 !important;
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
        background-color: #f8f9fa;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        width: 200px;
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
        position: relative;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: none;
    }
    .nav-tabs .nav-link.active {
        background-color: #f8f9fa;
        border-color: #dee2e6 #dee2e6 #fff;
    }
</style>
@endsection

@section('content')
<div class="container my-5">
    <div class="d-flex justify-content-between">
        <h1 id="article-title">{{ $article->title }}</h1>
    </div>

    <ul class="nav nav-tabs" id="codeTab" role="tablist">
        @if ($article->disp)
        <li class="nav-item" role="presentation">
            <a class="nav-link active" id="disp-tab" data-bs-toggle="tab" href="#disp" role="tab" aria-controls="disp" aria-selected="true">表示</a>
        </li>
        @endif
        @if ($article->code)
        <li class="nav-item" role="presentation">
            <a class="nav-link {{ $article->disp ? '' : 'active' }}" id="code-tab" data-bs-toggle="tab" href="#code" role="tab" aria-controls="code" aria-selected="{{ $article->disp ? 'false' : 'true' }}">{{ $article->language ?? 'Language 1' }}</a>
        </li>
        @endif
        @if ($article->code2)
        <li class="nav-item" role="presentation">
            <a class="nav-link" id="code2-tab" data-bs-toggle="tab" href="#code2" role="tab" aria-controls="code2" aria-selected="false">{{ $article->language2 ?? 'Language 2' }}</a>
        </li>
        @endif
        @if ($article->code3)
        <li class="nav-item" role="presentation">
            <a class="nav-link" id="code3-tab" data-bs-toggle="tab" href="#code3" role="tab" aria-controls="code3" aria-selected="false">{{ $article->language3 ?? 'Language 3' }}</a>
        </li>
        @endif
    </ul>
    <div class="tab-content my-4" id="codeTabContent">
        @if ($article->disp)
        <div class="tab-pane fade show active" id="disp" role="tabpanel" aria-labelledby="disp-tab">
            <div class="code-block p-3" id="article-disp">{!! $article->disp !!}</div>
        </div>
        @endif
        @if ($article->code)
        <div class="tab-pane fade {{ $article->disp ? '' : 'show active' }}" id="code" role="tabpanel" aria-labelledby="code-tab">
            <pre class="code-block p-3" id="article-code">{{ $article->code }}</pre>
        </div>
        @endif
        @if ($article->code2)
        <div class="tab-pane fade" id="code2" role="tabpanel" aria-labelledby="code2-tab">
            <pre class="code-block p-3" id="article-code2">{{ $article->code2 }}</pre>
        </div>
        @endif
        @if ($article->code3)
        <div class="tab-pane fade" id="code3" role="tabpanel" aria-labelledby="code3-tab">
            <pre class="code-block p-3" id="article-code3">{{ $article->code3 }}</pre>
        </div>
        @endif
    </div>

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

@section('Javascript')
<script>
    @if ($article->language === 'Javascript' && $article->code)
        document.addEventListener('DOMContentLoaded', function() {
            {!! $article->code !!}
        });
    @endif
    @if ($article->language2 === 'Javascript' && $article->code2)
        document.addEventListener('DOMContentLoaded', function() {
            {!! $article->code2 !!}
        });
    @endif
    @if ($article->language3 === 'Javascript' && $article->code3)
        document.addEventListener('DOMContentLoaded', function() {
            {!! $article->code3 !!}
        });
    @endif
</script>
@auth
    @if (Auth::user()->authority === 'maru')
<script>
    document.addEventListener('DOMContentLoaded', function() {
    const contextMenu = document.getElementById('contextMenu');
    const updateButton = document.getElementById('update-button');

    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        contextMenu.style.display = 'block';
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.zIndex = '1000'; // z-indexを設定
    });

    document.addEventListener('click', function(e) {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
        }
    });

    document.getElementById('menu-edit').addEventListener('click', function() {
        contextMenu.style.display = 'none';

        const titleElement = document.getElementById('article-title');
        const dispElement = document.getElementById('article-disp');
        const codeElement = document.getElementById('article-code');
        const codeElement2 = document.getElementById('article-code2');
        const codeElement3 = document.getElementById('article-code3');
        const explanationElement = document.getElementById('article-explanation');
        const codeTabList = document.getElementById('codeTab');
        const navItems = document.getElementsByClassName('nav-item');

        // タイトルを編集可能にする
        titleElement.innerHTML = `<input type="text" id="edit-title" value="${titleElement.textContent.trim()}" class="form-control"/>`;

        // 表示内容を編集可能にする
        if (dispElement) {
            document.getElementById('disp').style.display = 'block';
            const dispText = dispElement.innerHTML.trim();
            dispElement.innerHTML = `<textarea id="edit-disp" class="form-control" rows="10">${dispText}</textarea>`;
        }

        // コードを編集可能にする
        if (codeElement) {
            document.getElementById('code').style.display = 'block';
            const codeText = codeElement.textContent.trim();
            codeElement.innerHTML = `<textarea id="edit-code" class="form-control" rows="10">${codeText}</textarea>`;
        }

        if (codeElement2) {
            document.getElementById('code2').style.display = 'block';
            const codeText2 = codeElement2.textContent.trim();
            codeElement2.innerHTML = `<textarea id="edit-code2" class="form-control" rows="10">${codeText2}</textarea>`;
        }

        if (codeElement3) {
            document.getElementById('code3').style.display = 'block';
            const codeText3 = codeElement3.textContent.trim();
            codeElement3.innerHTML = `<textarea id="edit-code3" class="form-control" rows="10">${codeText3}</textarea>`;
        }

        // 説明を編集可能にする（HTMLタグをエスケープして表示）
        const explanationHTML = explanationElement.innerHTML
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&lt;/g, '&amp;lt;')
            .replace(/&gt;/g, '&amp;gt;')
            .replace(/&amp;/g, '&amp;amp;')
            .replace(/&quot;/g, '&amp;quot;')
            .replace(/&#039;/g, '&amp;#039;');

        explanationElement.innerHTML = `<textarea id="edit-explanation" class="form-control" rows="10">${explanationHTML}</textarea>`;

        // 言語タブを編集可能にする
        Array.from(navItems).forEach(item => {
            item.style.display = 'block';
        });
        codeTabList.querySelectorAll('.nav-link').forEach((tab, index) => {
            const lang = tab.textContent.trim();
            tab.innerHTML = `<input type="text" value="${lang}" class="form-control"/>`;
        });

        // 更新ボタンを表示
        updateButton.style.display = 'block';
    });

    updateButton.addEventListener('click', function() {
        const id = {{ $article->id }};
        const title = document.getElementById('edit-title').value;
        const disp = document.getElementById('edit-disp') ? document.getElementById('edit-disp').value : '';
        const code = document.getElementById('edit-code') ? document.getElementById('edit-code').value : '';
        const code2 = document.getElementById('edit-code2') ? document.getElementById('edit-code2').value : '';
        const code3 = document.getElementById('edit-code3') ? document.getElementById('edit-code3').value : '';
        const language = document.querySelector('#code-tab input') ? document.querySelector('#code-tab input').value : '';
        const language2 = document.querySelector('#code2-tab input') ? document.querySelector('#code2-tab input').value : '';
        const language3 = document.querySelector('#code3-tab input') ? document.querySelector('#code3-tab input').value : '';
        const explanation = document.getElementById('edit-explanation').value.replace(/\n/g, '<br>');

        fetch(`/article/update/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': '{{ csrf_token() }}'
            },
            body: JSON.stringify({
                title: title,
                disp: disp ? disp : null,
                code: code ? code : null,
                code2: code2 ? code2 : null,
                code3: code3 ? code3 : null,
                language: language ? language : null,
                language2: language2 ? language2 : null,
                language3: language3 ? language3 : null,
                explanation: explanation
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateButton.style.display = 'none';
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
            const id = {{ $article->id }};
            fetch(`/article/update/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': '{{ csrf_token() }}'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // 成功した場合、指定のページにリダイレクト
                    window.location.href = data.redirect;
                } else {
                    alert('削除に失敗しました');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('削除に失敗しました');
            });
        }
    });
});

</script>
        @endsection
    @endif
@endauth
