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

        return view('main.article', compact('article'));
    }
}
