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
        'code2' => 'nullable|string',
        'code3' => 'nullable|string',
        'language' => 'nullable|string|max:255',
        'language2' => 'nullable|string|max:255',
        'language3' => 'nullable|string|max:255',
        'explanation' => 'nullable|string',
    ], [
        'url.required' => 'URLが空白になっています。',
        'url.unique' => 'このURLは既に存在します。',
        'title.required' => 'タイトルが空白になっています。',
    ]);

    $max_sort = Article::where('type_id', $request->input('type'))
                        ->where('classification_id', $request->input('classification'))
                        ->max('sort');

    $article = new Article();
    $article->classification_id = $request->input('classification');
    $article->type_id = $request->input('type');
    $article->url = $request->input('url');
    $article->title = $request->input('title');
    $article->disp = $request->input('disp');
    $article->code = $request->input('code');
    $article->code2 = $request->input('code2');
    $article->code3 = $request->input('code3');
    $article->language = $request->input('language');
    $article->language2 = $request->input('language2');
    $article->language3 = $request->input('language3');
    $article->explanation = $request->input('explanation');
    $article->sort = $max_sort + 1;
    $article->save();

    return redirect()->route('article.registar.form')->with('status', 'article_registar_complete');
}

}

