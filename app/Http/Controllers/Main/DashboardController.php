<?php

namespace App\Http\Controllers\Main;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Article;

class DashboardController extends Controller
{
    public function get(){
        $articles = Article::orderBy('created_at', 'desc')->take(15)->get();
        dd($articles); 
        return view('main.main', compact('articles'));
    }
}
