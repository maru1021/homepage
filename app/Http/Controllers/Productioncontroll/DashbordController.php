<?php

namespace App\Http\Controllers\Productioncontroll;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class DashbordController extends Controller
{
    public function get(Request $request){
        return view('production_controll.dashbord');
    }
}