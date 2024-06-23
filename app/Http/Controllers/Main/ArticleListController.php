<?php

namespace App\Http\Controllers\Main;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Article;
use App\Models\Type;
use App\Models\Classification;

class ArticleListController extends Controller
{
    public function get(Request $request)
    {
        $query = Article::query();

        if ($request->filled('type')) {
            $query->where('type_id', $request->type);
        }

        if ($request->filled('classification')) {
            $query->where('classification_id', $request->classification);
        }

        $articles = $query->with(['type', 'classification'])->orderBy('sort')->get();
        $types = Type::orderBy('sort')->get();
        $classifications = Classification::orderBy('sort')->get();
        return view('article.article_list', compact('articles', 'types', 'classifications'));
    }

    public function updateSort(Request $request)
    {
        $sortedIds = $request->sortedIds;

        foreach ($sortedIds as $index => $id) {
            $article = Article::find($id);
            $article->sort = $index + 1;
            $article->save();
        }

        return response()->json(['success' => true]);
    }
}
