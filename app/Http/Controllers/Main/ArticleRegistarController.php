<?php

namespace App\Http\Controllers\Main;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Http\Requests\ProfileUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use App\Models\Classification;
use App\Models\Type;
use App\Models\Article;
use Illuminate\Support\Facades\Redirect;
use Illuminate\View\View;

class ArticleRegistarController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function get(Request $request): View
    {
        $title = '記事登録';
        $classifications = Classification::all();
        $types = Type::all();
        return view('article.registar', [
            'user' => $request->user(),
            'title' => $title,
            'classifications' => $classifications,
            'types' => $types,
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function registar(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'url' => 'required|string|max:255|unique:articles,url',
            'title' => 'required|string|max:255',
            'classification' => 'required|exists:classifications,id',
            'type' => 'required|exists:types,id',
            'code' => 'nullable|string',
            'explanation' => 'nullable|string',
        ], [
            'url.required' => 'URLが空白になっています。',
            'url.unique' => 'このURLは既に存在します。',
            'title.required' => 'タイトルが空白になっています。',
        ]);
        $max_sort = Article::where('type_id', $request->input('type'))
                            ->where('classification_id', $request->input('classification_id'))
                            ->max('sort');

        $article = new Article();
        $article->classification_id = $request->input('classification');
        $article->type_id = $request->input('type');
        $article->url = $request->input('url');
        $article->title = $request->input('title');
        $article->code = $request->input('code');
        $article->explanation = $request->input('explanation');
        $article->sort = $max_sort + 1;
        $article->save();

        return redirect()->route('article.registar.form')->with('status', 'article_registar_complete');
    }
}

