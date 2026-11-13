"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, DollarSign, Clock, CheckCircle, XCircle } from "lucide-react"
import { NewPurchaseModal } from "@/components/employee-purchases/new-purchase-modal"
import { PurchasesTable } from "@/components/employee-purchases/purchases-table"

export default function EmployeePurchasesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch purchases
  const fetchPurchases = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/employee-purchases')
      if (!response.ok) {
        console.error('Failed to fetch purchases:', response.status)
        setPurchases([])
        return
      }
      const data = await response.json()
      setPurchases(data.purchases || [])
    } catch (error) {
      console.error('Error fetching purchases:', error)
      setPurchases([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPurchases()
  }, [])

  // Calculate stats
  const pendingPurchases = purchases.filter((p: any) => p.status === 'pending')
  const pendingAmount = pendingPurchases.reduce((sum: number, p: any) => sum + p.amount, 0)
  const paidPurchases = purchases.filter((p: any) => p.status === 'paid')
  const paidAmount = paidPurchases.reduce((sum: number, p: any) => sum + p.amount, 0)

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
            💰 Employee Purchases
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage salary deductions and employee credit purchases
          </p>
        </div>
        <Button 
          size="lg" 
          onClick={() => setIsModalOpen(true)}
          className="shadow-lg"
        >
          <Plus className="mr-2 h-5 w-5" />
          New Purchase
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pending */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Pending
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  ₱{pendingAmount.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {pendingPurchases.length} purchases
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paid This Month */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Paid This Month
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  ₱{paidAmount.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {paidPurchases.length} purchases
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Employees */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Total Employees
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {new Set(purchases.map((p: any) => p.employee_name)).size}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  with purchases
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cancelled */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Cancelled
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {purchases.filter((p: any) => p.status === 'cancelled').length}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  purchases
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Purchases Table */}
      <PurchasesTable 
        purchases={purchases}
        loading={loading}
        onRefresh={fetchPurchases}
      />

      {/* New Purchase Modal */}
      <NewPurchaseModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false)
          fetchPurchases()
        }}
      />
    </div>
  )
}
