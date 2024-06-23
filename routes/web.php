<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Main\MainController;
use App\Http\Controllers\Main\ArticleRegistarController;
use App\Http\Controllers\Main\ArticleController;
use App\Http\Controllers\Main\ArticleListController;
use Illuminate\Support\Facades\Route;

Route::get('/', [MainController::class, 'edit'])->name('main.edit');

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::get('/article_register', [ArticleRegistarController::class, 'get'])->name('article.registar.form');
    Route::post('/article_register', [ArticleRegistarController::class, 'registar'])->name('article.registar.registar');
    Route::post('/article/update/{id}', [ArticleController::class, 'update'])->name('article.update');
    Route::delete('/article/update/{id}', [ArticleController::class, 'delete'])->name('article.delete');
    Route::get('/articlelist', [ArticleListController::class, 'get'])->name('article.list');
    Route::post('/articlelist', [ArticleListController::class, 'updateSort'])->name('article.update.sort');
});

Route::get('/article/{type}/{classification}/{url}', [ArticleController::class, 'get'])->name('article.get');


require __DIR__.'/auth.php';
