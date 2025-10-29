import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function AddProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "",
    price: "",
    quantity: "",
    weighted: false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/products", {
        ...form,
        price: parseFloat(form.price),
        quantity: parseInt(form.quantity),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product Added", description: "New product successfully added." });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add product.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Product ID (manual)</Label>
            <Input
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              placeholder="Enter Product ID"
            />
          </div>
          <div>
            <Label>Product Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Enter Product Name"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Enter Product Description"
            />
          </div>
          <div>
            <Label>Price (₱)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="Enter Price"
            />
          </div>
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="Enter Quantity"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Needs to be weighted (Price per kilo)</Label>
            <Switch
              checked={form.weighted}
              onCheckedChange={(checked) => setForm({ ...form, weighted: checked })}
            />
          </div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Add Product
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
