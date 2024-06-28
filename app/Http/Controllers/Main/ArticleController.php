<?php

namespace App\Http\Controllers\Main;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Article;
use Illuminate\View\View;

class ArticleController extends Controller
{
    public function get($type, $classification, $url): View
    {
        // URLデコードを行う
        $type = urldecode($type);
        $classification = urldecode($classification);
        $url = urldecode($url);

        // 記事を検索
        $article = Article::where('url', $url)
                        ->whereHas('classification', function($query) use ($classification) {
                            $query->where('classification', $classification);
                        })
                        ->whereHas('type', function($query) use ($type) {
                            $query->where('type', $type);
                        })
                        ->firstOrFail();

        $title = $article->title;

        return view('main.article', compact('article', 'title'));
    }

    public function update(Request $request, $id)
    {
        $article = Article::findOrFail($id);
        $article->title = $request->input('title');
        $article->disp = $request->input('disp');
        $article->code = $request->input('code');
        $article->code2 = $request->input('code2');
        $article->code3 = $request->input('code3');
        $article->language = $request->input('language');
        $article->language2 = $request->input('language2');
        $article->language3 = $request->input('language3');
        $article->explanation = $request->input('explanation');
        $article->updated_at = now();
        $article->save();

        return response()->json(['success' => true]);
    }

    public function delete($id)
    {
        $article = Article::findOrFail($id);
        $article->delete();

        return response()->json(['success' => true, 'redirect' => route('dashbord.get')]);
    }
}
