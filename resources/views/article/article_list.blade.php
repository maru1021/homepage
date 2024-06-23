@extends('layouts.app')

@section('head')
<style>
    .sortable-row {
        cursor: move;
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
    <h1>記事一覧</h1>
        <div class="row">
            <div class="mb-3 col-6">
                <label for="type-filter" class="form-label">種別</label>
                <select class="form-control" id="type-filter">
                    <option value="">すべて</option>
                    @foreach ($types as $type)
                        <option value="{{ $type->id }}" {{ request('type') == $type->id ? 'selected' : '' }}>{{ $type->type }}</option>
                    @endforeach
                </select>
            </div>
            <div class="mb-3 col-6">
                <label for="classification-filter" class="form-label">分類</label>
                <select class="form-control" id="classification-filter">
                    <option value="">すべて</option>
                    @foreach ($classifications as $classification)
                        <option value="{{ $classification->id }}" {{ request('classification') == $classification->id ? 'selected' : '' }}>{{ $classification->classification }}</option>
                    @endforeach
                </select>
            </div>
        </div>
    <table class="table">
        <thead>
            <tr>
                <th>種別</th>
                <th>分類</th>
                <th>タイトル</th>
            </tr>
        </thead>
        <tbody id="sortable">
            @foreach ($articles as $article)
                <tr class="sortable-row" data-id="{{ $article->id }}">
                    <td>{{ $article->type->type }}</td>
                    <td>{{ $article->classification->classification }}</td>
                    <td>{{ $article->title }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
    <button id="update-button" class="btn btn-primary update-button">更新</button>
</div>
@endsection

@section('Javascript')
<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.min.js"></script>
<script>
    $(function() {
        $("#sortable").sortable({
            update: function(event, ui) {
                $('#update-button').show();
            }
        });

        $('#update-button').on('click', function() {
            var sortedIds = $("#sortable").sortable("toArray", { attribute: 'data-id' });
            $.ajax({
                url: '{{ route("article.update.sort") }}',
                method: 'POST',
                data: {
                    sortedIds: sortedIds,
                    _token: '{{ csrf_token() }}'
                },
                success: function(response) {
                    if (response.success) {
                        $('#update-button').hide();
                        location.reload();
                    } else {
                        alert('更新に失敗しました');
                    }
                },
                error: function() {
                    alert('更新に失敗しました');
                }
            });
        });

        $('#type-filter, #classification-filter').on('change', function() {
            var type = $('#type-filter').val();
            var classification = $('#classification-filter').val();
            var url = '{{ route("article.list") }}' + '?type=' + type + '&classification=' + classification;
            window.location.href = url;
        });
    });
</script>
@endsection
