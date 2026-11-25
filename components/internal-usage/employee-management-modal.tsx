"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, X, Plus, Edit, Trash2, Search, AlertCircle } from "lucide-react"
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

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
        await apiPut(`/api/employees/${editingId}`, formData)
        toast.success('Employee updated successfully')
      } else {
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
    setDeleteTarget({ id, name })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/api/employees/${deleteTarget.id}`)
      toast.success('Employee deleted successfully')
      await fetchEmployees()
      setDeleteTarget(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete employee')
    } finally {
      setDeleting(false)
    }
  }

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.department?.toLowerCase().includes(search.toLowerCase()) ||
    emp.position?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-3xl h-[72vh] p-0 gap-0 flex flex-col bg-white rounded-xl overflow-hidden border-0 shadow-2xl"
        hideCloseButton
      >
        {/* ── Header ── compact, no extra vertical padding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 16px',
            background: '#1e293b',
            borderBottom: '1px solid #334155',
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: '#2563eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Users style={{ width: 14, height: 14, color: '#fff' }} />
          </div>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#fff' }}>
            Employee Management
            <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: '#94a3b8', marginTop: 1 }}>
              Manage employees for purchase tracking and salary deductions
            </span>
          </span>
          <button
            onClick={onClose}
            style={{
              width: 24, height: 24, borderRadius: 5,
              background: '#334155',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#475569')}
            onMouseLeave={e => (e.currentTarget.style.background = '#334155')}
          >
            <X style={{ width: 13, height: 13, color: '#fff' }} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* LEFT — Form */}
          <div className="w-[300px] flex-shrink-0 border-r border-slate-200 flex flex-col bg-slate-50">
            <div className="px-5 pt-4 pb-3 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {editingId ? 'Edit Employee' : 'Add Employee'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Name */}
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Employee Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter full name"
                  className="h-10 bg-white border-slate-200 text-slate-900"
                  autoFocus
                />
              </div>

              {/* Department */}
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Department
                </Label>
                <Select
                  value={formData.department || undefined}
                  onValueChange={val => setFormData({ ...formData, department: val })}
                >
                  <SelectTrigger className="h-10 bg-white border-slate-200">
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
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Position <span className="normal-case font-normal text-slate-400">(optional)</span>
                </Label>
                <Input
                  value={formData.position}
                  onChange={e => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Job title"
                  className="h-10 bg-white border-slate-200 text-slate-900"
                />
              </div>
            </div>

            {/* Form Buttons */}
            <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
              {editingId && (
                <Button
                  variant="outline"
                  onClick={resetForm}
                  disabled={loading}
                  className="flex-1 h-10 rounded-md border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-100"
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={loading || !formData.name.trim()}
                className={`h-10 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm ${editingId ? 'flex-1' : 'w-full'}`}
              >
                {loading ? (
                  <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-r-transparent" />{editingId ? 'Updating...' : 'Adding...'}</>
                ) : (
                  <><Plus className="h-4 w-4 mr-1.5" />{editingId ? 'Update Employee' : 'Add Employee'}</>
                )}
              </Button>
            </div>
          </div>

          {/* RIGHT — Employee List */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">

            {/* Search */}
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search employees..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-10 bg-slate-50 border-slate-200 text-sm"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading && !employees.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="h-8 w-8 mb-3 animate-spin rounded-full border-2 border-slate-300 border-r-transparent" />
                  <p className="text-sm">Loading employees...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Users className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium text-slate-500">
                    {search ? 'No employees found' : 'No employees yet'}
                  </p>
                  <p className="text-xs mt-1 text-slate-400">
                    {search ? 'Try a different search term' : 'Add your first employee using the form'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEmployees.map(employee => (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">{employee.name}</p>
                          {employee.status === 'inactive' && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 px-1.5 py-0 flex-shrink-0">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        {(employee.department || employee.position) && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {employee.department && (
                              <div className="flex items-center gap-1">
                                <img src={DEPARTMENT_ICONS[employee.department]} alt={employee.department} className="w-3 h-3 object-contain" />
                                <span className="text-xs text-slate-500">{employee.department}</span>
                              </div>
                            )}
                            {employee.position && (
                              <>
                                {employee.department && <span className="text-xs text-slate-300">•</span>}
                                <span className="text-xs text-slate-400 truncate">{employee.position}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(employee)}
                          className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-600 rounded-md"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {employee.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(employee.id, employee.name)}
                            className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600 rounded-md text-slate-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full h-9 rounded-md border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100"
          >
            Close
          </Button>
        </div>

      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Modal */}
    <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
      <DialogContent className="max-w-[420px] p-0 gap-0 rounded-xl border-0 shadow-2xl overflow-hidden">
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', background: '#1e293b',
          borderBottom: '1px solid #334155', flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Trash2 style={{ width: 14, height: 14, color: '#fff' }} />
          </div>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#fff' }}>
            Delete Employee
          </span>
          <button
            onClick={() => setDeleteTarget(null)}
            style={{
              width: 24, height: 24, borderRadius: 5, background: '#334155',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#475569')}
            onMouseLeave={e => (e.currentTarget.style.background = '#334155')}
          >
            <X style={{ width: 13, height: 13, color: '#fff' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 bg-white space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-0.5">Employee</p>
            <p className="text-sm font-bold text-slate-900">{deleteTarget?.name}</p>
          </div>
          <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-900 mb-0.5">This action cannot be undone</p>
              <p className="text-xs text-red-700 leading-relaxed">
                This employee will be permanently deleted from the database.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            className="h-9 px-4 rounded-md border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            disabled={deleting}
            className="h-9 px-4 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-sm"
          >
            {deleting ? (
              <><div className="h-3.5 w-3.5 mr-2 animate-spin rounded-full border-2 border-white border-r-transparent" />Deleting...</>
            ) : (
              <><Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete Employee</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>
  )
}
