@extends('layouts.app')

@section('head')
<style>
    .page-title {
        font-size: 2.5rem; /* 文字サイズを大きくします */
        font-weight: bold; /* 太字にします */
        margin-bottom: 1.5rem; /* 下の余白を追加します */
    }
    .card-link {
        text-decoration: none;
        color: inherit;
    }
    .card-link .card {
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .card-link .card:hover {
        transform: translateY(-5px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
</style>
@endsection

@section('content')
<div class="container my-5">
    <h1 class="page-title">最新ページ</h1>
    <div class="row">
        @foreach($articles as $index => $article)
            <div class="col-md-4 mb-4">
                <a href="{{ url('article/' . $article->type->type . '/' . $article->classification->classification . '/' . $article->url) }}" class="card-link">
                    <div class="card">
                        <div class="card-body">
                            <p class="card-text"><strong>種別</strong> {{ $article->type->type }}</p>
                            <p class="card-text"><strong>分類</strong> {{ $article->classification->classification }}</p>
                            <p class="card-title"><strong>タイトル</strong> {{ $article->title }}</p>
                            <p class="card-text">{{ Str::limit(strip_tags($article->explanation), 100, '...') }}</p>
                            <p class="card-text"><small class="text-muted">{{ $article->created_at->format('Y-m-d H:i') }}</small></p>
                        </div>
                    </div>
                </a>
            </div>
            @if(($index + 1) % 3 == 0 && !$loop->last)
                </div><div class="row">
            @endif
        @endforeach
    </div>
</div>
@endsection
