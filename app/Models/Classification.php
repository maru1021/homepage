<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Classification extends Model
{
    use HasFactory;

    protected $fillable = ['classification', 'type_id', 'sort'];

    public function type()
    {
        return $this->belongsTo(Type::class);
    }

    public function articles()
    {
        return $this->hasMany(Article::class)->orderBy('sort');
    }
}
