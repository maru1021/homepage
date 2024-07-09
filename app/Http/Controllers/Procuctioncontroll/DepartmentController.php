<?php

namespace App\Http\Controllers\Procuctioncontroll;

use App\Http\Controllers\Controller;
use Illuminate\Validation\ValidationException;
use App\Models\Department;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index()
    {
        return response()->json(Department::all());
    }

    public function registar(Request $request)
    {
        try {
            $request->validate([
                'name' => 'required|string|max:255|unique:departments,name',
            ]);

            Department::create($request->only('name'));
            return response()->json(['success' => '部署が登録されました']);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()]);
        }
    }
}
