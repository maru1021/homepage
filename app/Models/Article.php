<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Article extends Model
{
    use HasFactory;

    protected $fillable = [
        'classification_id',
        'type_id',
        'url',
        'title',
        'code',
        'code2',
        'code3',
        'language',
        'language2',
        'language3',
        'explanation',
        'disp',
        'sort'
    ];

    public function classification()
    {
        return $this->belongsTo(Classification::class);
    }

    public function type()
    {
        return $this->belongsTo(Type::class);
    }
}
