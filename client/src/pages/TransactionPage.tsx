import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Printer } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export default function TransactionPage() {
  const [productId, setProductId] = useState("");
  const [cart, setCart] = useState<Product[]>([]);
  const [isPaid, setIsPaid] = useState(false);
  const { toast } = useToast();

  // ✅ Fetch product by ID
  const fetchProduct = async (id: string): Promise<Product> => {
    const res = await fetch(`/api/products/${id}`);
    if (!res.ok) throw new Error("Product not found");
    return res.json();
  };

  const handleAddProduct = async () => {
    if (!productId.trim()) return;
    try {
      const product = await fetchProduct(productId);
      setCart((prev) => [...prev, product]);
      setProductId("");
    } catch {
      toast({
        title: "Error",
        description: "Product not found",
        variant: "destructive",
      });
    }
  };

  const handlePay = () => {
    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Add products before paying",
        variant: "destructive",
      });
      return;
    }
    setIsPaid(true);
    toast({
      title: "Payment Successful",
      description: "Transaction completed — receipt ready.",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setCart([]);
    setIsPaid(false);
  };

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const transactionId = Math.floor(100000 + Math.random() * 900000);
  const date = new Date().toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto shadow-lg">
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Create New Transaction</CardTitle>
          {isPaid && (
            <div className="flex gap-2">
              <Button onClick={handlePrint} variant="outline" size="sm">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button onClick={handleReset} variant="outline" size="sm">
                New
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!isPaid ? (
            <>
              <div className="flex space-x-2 mb-4">
                <Input
                  placeholder="Enter Product ID"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddProduct()}
                />
                <Button onClick={handleAddProduct}>Add</Button>
              </div>

              {cart.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="text-right">
                            ₱{item.price.toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={2} className="font-bold text-right">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ₱{total.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">
                  No products added yet
                </p>
              )}

              <div className="flex justify-end mt-6">
                <Button
                  disabled={cart.length === 0}
                  onClick={handlePay}
                  className="gap-2"
                >
                  <DollarSign className="w-4 h-4" />
                  Pay
                </Button>
              </div>
            </>
          ) : (
            // ✅ Printable Receipt Section
            <div
              id="receipt"
              className="font-mono text-sm bg-white text-black p-6 rounded-md border border-gray-300 print:w-full print:shadow-none"
            >
              <h2 className="text-center font-bold text-lg mb-1">
                BLCM Hardware
              </h2>
              <p className="text-center text-xs mb-4">
                123 Main Street, Barangay Poblacion, PH
                <br />
                Tel: (02) 1234-5678
              </p>
              <div className="flex justify-between text-xs mb-2">
                <span>Transaction ID: {transactionId}</span>
                <span>{date}</span>
              </div>
              <hr className="my-2 border-gray-400" />
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="text-left">Item</th>
                    <th className="text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td className="text-right">
                        ₱{item.price.toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-400 font-bold">
                    <td className="pt-2">Total</td>
                    <td className="text-right pt-2">
                      ₱{total.toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tbody>
              </table>
              <hr className="my-3 border-gray-400" />
              <p className="text-center text-xs">
                Thank you for shopping at BLCM Hardware!
                <br />
                Please come again.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
