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

            <!-- タブの追加 -->
            <ul class="nav nav-tabs" id="codeTab" role="tablist">
                <li class="nav-item" role="presentation">
                    <a class="nav-link active" id="disp-tab" data-bs-toggle="tab" href="#disp" role="tab" aria-controls="disp" aria-selected="true">表示</a>
                </li>
                <li class="nav-item" role="presentation">
                    <a class="nav-link" id="code-tab" data-bs-toggle="tab" href="#code" role="tab" aria-controls="code" aria-selected="false">Language 1</a>
                </li>
                <li class="nav-item" role="presentation">
                    <a class="nav-link" id="code2-tab" data-bs-toggle="tab" href="#code2" role="tab" aria-controls="code2" aria-selected="false">Language 2</a>
                </li>
                <li class="nav-item" role="presentation">
                    <a class="nav-link" id="code3-tab" data-bs-toggle="tab" href="#code3" role="tab" aria-controls="code3" aria-selected="false">Language 3</a>
                </li>
            </ul>

            <div class="tab-content my-4" id="codeTabContent">
                <div class="tab-pane fade show active" id="disp" role="tabpanel" aria-labelledby="disp-tab">
                    <div class="mb-3">
                        <x-input-label for="disp">表示</x-input-label>
                        <textarea class="form-control" id="disp" name="disp" rows="10">{{ old('disp') }}</textarea>
                    </div>
                </div>

                <div class="tab-pane fade" id="code" role="tabpanel" aria-labelledby="code-tab">
                    <div class="mb-3">
                        <x-input-label for="language">言語 1</x-input-label>
                        <x-text-input id="language" name="language" type="text" class="mt-1 block w-full" value="{{ old('language') }}"/>
                    </div>
                    <div class="mb-3">
                        <x-input-label for="code">コード 1</x-input-label>
                        <textarea class="form-control" id="code" name="code" rows="10">{{ old('code') }}</textarea>
                    </div>
                </div>

                <div class="tab-pane fade" id="code2" role="tabpanel" aria-labelledby="code2-tab">
                    <div class="mb-3">
                        <x-input-label for="language2">言語 2</x-input-label>
                        <x-text-input id="language2" name="language2" type="text" class="mt-1 block w-full" value="{{ old('language2') }}"/>
                    </div>
                    <div class="mb-3">
                        <x-input-label for="code2">コード 2</x-input-label>
                        <textarea class="form-control" id="code2" name="code2" rows="10">{{ old('code2') }}</textarea>
                    </div>
                </div>

                <div class="tab-pane fade" id="code3" role="tabpanel" aria-labelledby="code3-tab">
                    <div class="mb-3">
                        <x-input-label for="language3">言語 3</x-input-label>
                        <x-text-input id="language3" name="language3" type="text" class="mt-1 block w-full" value="{{ old('language3') }}"/>
                    </div>
                    <div class="mb-3">
                        <x-input-label for="code3">コード 3</x-input-label>
                        <textarea class="form-control" id="code3" name="code3" rows="10">{{ old('code3') }}</textarea>
                    </div>
                </div>
            </div>

            <div class="mb-3">
                <label for="explanation" class="form-label mt-1">説明</label>
                <textarea class="form-control" id="explanation" name="explanation" rows="10">{{ old('explanation') }}</textarea>
            </div>

            <button type="submit" class="btn btn-primary">登録</button>
        </div>
    </form>
@endsection

@section('Javascript')
<script>
    document.addEventListener('DOMContentLoaded', function() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-pane');

        // タブクリック時の処理
        navItems.forEach((navItem, index) => {
            navItem.addEventListener('click', function() {
                navItems.forEach(item => item.querySelector('.nav-link').classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('show', 'active'));

                navItem.querySelector('.nav-link').classList.add('active');
                tabContents[index].classList.add('show', 'active');
            });
        });
    });
</script>
@endsection
