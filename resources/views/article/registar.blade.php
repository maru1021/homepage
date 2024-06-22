@extends('layouts.app')

@section('content')
    @if (session('status') === 'article_registar_complete')
        <div class="alert alert-success mt-3">
            記事が追加されました。
        </div>
    @endif

    <form method="post" action="{{ route('article.registar.registar') }}" class="mt-6 space-y-6">
        @csrf
        <div class="container" id="input_area">
            <div class="mb-3">
                <label for="type" class="form-label">区分</label>
                <select class="form-control" id="type" name="type">
                    @foreach($types as $type)
                        <option value="{{ $type->id }}">{{ $type->type }}</option>
                    @endforeach
                </select>
            </div>

            <div class="mb-3">
                <label for="classification" class="form-label">言語</label>
                <select class="form-control" id="classification" name="classification">
                    @foreach($classifications as $classification)
                        <option value="{{ $classification->id }}">{{ $classification->classification }}</option>
                    @endforeach
                </select>
            </div>

            <div>
                <x-input-label for="url">URL</x-input-label>
                <x-text-input id="url" name="url" type="text" class="mt-1 block w-full" value="{{ old('url') }}" required />
                @error('url')
                    <div class="text-danger">{{ $message }}</div>
                @enderror
            </div>

            <div>
                <x-input-label for="title">タイトル</x-input-label>
                <x-text-input id="title" name="title" type="text" class="mt-1 block w-full" value="{{old('title')}}" required/>
                @error('title')
                    <div class="text-danger">{{ $message }}</div>
                @enderror
            </div>

            <div class="mb-3">
                <label for="code" class="form-label mt-1">コード</label>
                <textarea class="form-control" id="code" name="code" rows="10">{{ old('code') }}</textarea>
            </div>

            <div class="mb-3">
                <label for="explanation" class="form-label mt-1">説明</label>
                <textarea class="form-control" id="explanation" name="explanation" rows="10">{{ old('explanation') }}</textarea>
            </div>

            <button type="submit" class="btn btn-primary">登録</button>
        </div>
    </form>
@endsection

