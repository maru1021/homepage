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
        {{ $articles }}
        
    </div>
</div>
@endsection
