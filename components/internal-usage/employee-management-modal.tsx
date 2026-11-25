"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, X, Plus, Edit, Trash2, Search } from "lucide-react"
import { toast } from "sonner"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"

interface Employee {
  id: string
  name: string
  department?: string
  position?: string
  status: 'active' | 'inactive'
  created_at: string
}

const DEPARTMENTS = ['Facebook', 'TikTok', 'Shopee', 'Lazada', 'Office']

const DEPARTMENT_ICONS: Record<string, string> = {
  'Facebook': '/facebook.png',
  'TikTok': '/tiktok.png',
  'Shopee': '/Shopee.png',
  'Lazada': '/Lazada.png',
  'Office': '/Corporate Building.png'
}

interface EmployeeManagementModalProps {
  open: boolean
  onClose: () => void
}

export function EmployeeManagementModal({ open, onClose }: EmployeeManagementModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    position: ''
  })

  useEffect(() => {
    if (open) {
      fetchEmployees()
      resetForm()
    }
  }, [open])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const data = await apiGet<Employee[]>('/api/employees?status=all')
      setEmployees(Array.isArray(data) ? data : [])
    } catch (error) {
      toast.error('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', department: '', position: '' })
    setEditingId(null)
  }

  const handleEdit = (employee: Employee) => {
    setFormData({
      name: employee.name,
      department: employee.department || '',
      position: employee.position || ''
    })
    setEditingId(employee.id)
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Employee name is required')
      return
    }

    setLoading(true)
    try {
      if (editingId) {
        // Update
        await apiPut(`/api/employees/${editingId}`, formData)
        toast.success('Employee updated successfully')
      } else {
        // Create
        await apiPost('/api/employees', formData)
        toast.success('Employee added successfully')
      }
      await fetchEmployees()
      resetForm()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save employee')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Mark "${name}" as inactive?`)) return

    setLoading(true)
    try {
      await apiDelete(`/api/employees/${id}`)
      toast.success('Employee marked as inactive')
      await fetchEmployees()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete employee')
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.department?.toLowerCase().includes(search.toLowerCase()) ||
    emp.position?.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = employees.filter(e => e.status === 'active').length
  const inactiveCount = employees.filter(e => e.status === 'inactive').length

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[75vh] p-0 gap-0 bg-white rounded-lg overflow-hidden border shadow-xl" hideCloseButton>
        {/* Header */}
        <div className="relative bg-slate-800 px-6 py-3 border-b border-slate-700 flex items-center">
          <div className="flex items-center gap-3 pr-8">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold" style={{ color: '#ffffff' }}>Employee Management</h2>
              <p className="text-[11px] mt-0.5" style={{ color: '#d1d5db' }}>
                Manage employees for internal usage tracking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-2.5 right-3 w-7 h-7 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Body - Left/Right Layout */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* LEFT SIDE - Add Employee Form */}
          <div className="w-[320px] border-r border-slate-200 p-5 space-y-3 overflow-y-auto bg-slate-50">
            <div className="space-y-1 mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingId ? 'Edit Employee' : 'Add Employee'}
              </h3>
              <p className="text-xs text-slate-600">
                {editingId ? 'Update employee information' : 'Enter employee details below'}
              </p>
            </div>

            {/* Name Input */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Employee Name *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter full name"
                className="h-9 mt-1 bg-white"
                autoFocus
              />
            </div>

            {/* Department */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Department</Label>
              <Select 
                value={formData.department || undefined} 
                onValueChange={val => setFormData({ ...formData, department: val })}
              >
                <SelectTrigger className="h-9 mt-1 bg-white">
                  {formData.department ? (
                    <div className="flex items-center gap-2">
                      <img src={DEPARTMENT_ICONS[formData.department]} alt={formData.department} className="w-4 h-4 object-contain" />
                      <span className="text-sm">{formData.department}</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Select department" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(dept => (
                    <SelectItem key={dept} value={dept}>
                      <div className="flex items-center gap-2">
                        <img src={DEPARTMENT_ICONS[dept]} alt={dept} className="w-4 h-4 object-contain" />
                        <span className="text-sm">{dept}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Position */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Position</Label>
              <Input
                value={formData.position}
                onChange={e => setFormData({ ...formData, position: e.target.value })}
                placeholder="Job title (optional)"
                className="h-9 mt-1 bg-white"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              {editingId && (
                <Button 
                  variant="outline" 
                  onClick={resetForm} 
                  disabled={loading}
                  className="flex-1 h-9"
                >
                  Cancel
                </Button>
              )}
              <Button 
                onClick={handleSubmit} 
                disabled={loading || !formData.name.trim()} 
                className={`h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm text-sm ${editingId ? 'flex-1' : 'w-full'}`}
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    {editingId ? 'Updating...' : 'Adding...'}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    {editingId ? 'Update Employee' : 'Add Employee'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* RIGHT SIDE - Employee List */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            
            {/* Search Bar */}
            <div className="px-4 py-3 border-b border-slate-200 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search employees..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
                />
              </div>
            </div>

            {/* Employee List */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                {loading && !employees.length ? (
                  <div className="text-center py-16 text-slate-500">
                    <div className="h-8 w-8 mx-auto mb-3 animate-spin rounded-full border-3 border-slate-300 border-r-transparent" />
                    <p className="text-sm">Loading employees...</p>
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">
                      {search ? 'No employees found' : 'No employees yet'}
                    </p>
                    <p className="text-xs mt-1">
                      {search ? 'Try a different search term' : 'Add your first employee using the form'}
                    </p>
                  </div>
                ) : (
                  filteredEmployees.map(employee => (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-slate-900 truncate">{employee.name}</h4>
                          {employee.status === 'inactive' && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 flex-shrink-0 px-1.5 py-0">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        {(employee.department || employee.position) && (
                          <div className="flex items-center gap-2 mt-0.5">
                            {employee.department && (
                              <span className="text-xs text-slate-600">{employee.department}</span>
                            )}
                            {employee.position && (
                              <>
                                {employee.department && <span className="text-xs text-slate-400">•</span>}
                                <span className="text-xs text-slate-500 truncate">{employee.position}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(employee)}
                          className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-600"
                          title="Edit employee"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {employee.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(employee.id, employee.name)}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Mark as inactive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-5 py-3">
          <Button
            variant="outline"
            className="w-full h-9 rounded-lg font-semibold text-sm"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
