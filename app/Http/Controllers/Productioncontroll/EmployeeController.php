<?php

namespace App\Http\Controllers\Productioncontroll;

use App\Http\Controllers\Controller;
use Illuminate\Validation\ValidationException;
use App\Models\Employee;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    public function get()
    {
        return view('production_controll.employee');
    }

    public function index()
    {
        $employee = Employee::with('department')->get();
        return response()->json($employee);
    }

    public function registar(Request $request)
    {
        $request->validate([
            'employee_number' => 'required|string|max:11|unique:employees',
            'name' => 'required|string|max:50',
            'address' => 'required|string',
            'phone' => 'required|string',
            'birth_date' => 'required|date',
            'department_id' => 'required|integer|exists:departments,id',
        ]);

        $employee = Employee::create($request->all());

        return response()->json(['success' => '社員が登録されました', 'employee' => $employee]);
    }

    public function editdata($id)
    {
        $employee = Employee::findOrFail($id);
        return response()->json($employee);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'employee_number' => 'required|string|max:5|unique:employees,employee_number,' . $id,
            'name' => 'required|string|max:50',
            'address' => 'required|string',
            'phone' => 'required|string|max:11',
            'birth_date' => 'required|date',
            'department_id' => 'required|integer|exists:departments,id',
        ]);

        try {
            $employee = Employee::findOrFail($id);
            $employee->update($request->all());

            return response()->json(['success' => '社員情報が更新されました']);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    public function delete($id){
        $employee = Employee::findOrFail($id);
        $employee->delete();

        return response()->json(['success' => '社員が削除されました']);
    }
}
