import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/AuthProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowLeft, X, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { apiRequest } from "@/lib/queryClient";

interface OrderWithDetails {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    quantity: number;
  };
  user?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
}

export default function Orders() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
    enabled: !!user,
  });

  // Confirm order (deduct stock)
  const confirmMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("POST", `/api/orders/${orderId}/confirm`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Order Confirmed",
        description: "Stock has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to confirm order",
        description: error?.message || "Check stock and try again.",
        variant: "destructive",
      });
    },
  });

  // Cancel order
  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("POST", `/api/orders/${orderId}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Order Cancelled",
        description: "The order has been cancelled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to cancel order.",
        variant: "destructive",
      });
    },
  });

  const handleConfirmOrder = (orderId: string) => {
    if (confirm("Confirm this order? This will deduct stock.")) {
      confirmMutation.mutate(orderId);
    }
  };

  const handleCancelOrder = (orderId: string) => {
    if (confirm("Are you sure you want to cancel this order?")) {
      cancelMutation.mutate(orderId);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "confirmed":
        return <CheckCircle className="w-4 h-4" />;
      case "cancelled":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "confirmed":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "default";
    }
  };

  const isAdminOrStaff = user?.role && ["admin", "staff"].includes(user.role);

  const canCancelOrder = (order: OrderWithDetails) => {
    return order.status === "pending" && order.userId === user?.id;
  };

  const canConfirmOrder = (order: OrderWithDetails) => {
    return isAdminOrStaff && order.status === "pending";
  };

  const columns = [
    {
      header: "Order ID",
      accessorKey: "id",
      cell: ({ row }: any) => (
        <span className="font-mono text-sm">
          {row.original.id.substring(0, 8)}...
        </span>
      ),
    },
    {
      header: "Product",
      accessorKey: "product",
      cell: ({ row }: any) => (
        <div>{row.original.product?.name || "Unknown Product"}</div>
      ),
    },
    ...(isAdminOrStaff
      ? [
          {
            header: "Customer",
            accessorKey: "user",
            cell: ({ row }: any) => (
              <div>
                {row.original.user
                  ? `${row.original.user.firstName || row.original.user.username}`
                  : "Unknown User"}
              </div>
            ),
          },
        ]
      : []),
    {
      header: "Quantity",
      accessorKey: "quantity",
      cell: ({ row }: any) => <span>{row.original.quantity}</span>,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }: any) => (
        <Badge
          variant={getStatusColor(row.original.status) as any}
          className="flex items-center gap-1"
        >
          {getStatusIcon(row.original.status)}
          <span className="capitalize">{row.original.status}</span>
        </Badge>
      ),
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ row }: any) => (
        <span className="text-sm">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: ({ row }: any) => (
        <div className="flex space-x-2">
          {canConfirmOrder(row.original) && (
            <Button
              size="sm"
              onClick={() => handleConfirmOrder(row.original.id)}
              disabled={confirmMutation.isPending}
              title="Confirm this order (deducts stock)"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              {confirmMutation.isPending ? "Confirming…" : "Confirm"}
            </Button>
          )}
          {canCancelOrder(row.original) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCancelOrder(row.original.id)}
              disabled={cancelMutation.isPending}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">
                  {isAdminOrStaff ? "All Orders" : "My Orders"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isAdminOrStaff
                    ? "Manage and confirm customer orders"
                    : "View and track your orders"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              <span>Orders</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  {isAdminOrStaff
                    ? "No orders found"
                    : "You haven't placed any orders yet"}
                </p>
                {!isAdminOrStaff && (
                  <Link href="/products">
                    <Button>
                      <Package className="w-4 h-4 mr-2" />
                      Browse Products
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <DataTable columns={columns} data={orders} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
