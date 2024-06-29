<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Main\MainController;
use App\Http\Controllers\Main\ArticleRegistarController;
use App\Http\Controllers\Main\ArticleController;
use App\Http\Controllers\Main\ArticleListController;
use Illuminate\Support\Facades\Route;
use SebastianBergmann\CodeCoverage\Report\Html\Dashboard;

Route::get('/', [MainController::class, 'edit'])->name('dashbord.get');

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
Route::get('/3D/operation', function(){return view('3D.operation');})->name('3D.operation');
Route::get('/3D/mirror', function(){return view('3D.mirror');})->name('3D.mirror');
Route::get('/3D/universe', function(){return view('3D.universe');})->name('3D.universe');
Route::get('/3D/MMD', function(){return view('3D.MMD');})->name('3D.MMD');


require __DIR__.'/auth.php';
