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
</style>
@endsection

@section('content')
<div class="container my-5">
    <h1>{{ $article->title }}</h1>

    @if ($article->code)
        <div class="my-4">
            <h5>コード:</h5>
            <pre class="code-block p-3">{{ $article->code }}</pre>
        </div>
    @endif

    <div class="my-4">
        <p class="explanation">{!! nl2br($article->explanation) !!}</p>
    </div>
</div>
@endsection
