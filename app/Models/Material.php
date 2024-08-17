<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Material extends Model
{
    use HasFactory;
    protected $fillable = ['name', 'material_maker_id'];

    public function material_maker(){
        return $this->belongsTo(MaterialMaker::class);
    }
}
