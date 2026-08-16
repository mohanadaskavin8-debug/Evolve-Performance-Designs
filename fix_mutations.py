import os
import re

files_to_process = [
    "artifacts/admin/src/pages/orders/index.tsx",
    "artifacts/admin/src/pages/orders/detail.tsx",
    "artifacts/admin/src/pages/products/index.tsx",
    "artifacts/admin/src/pages/products/new.tsx",
    "artifacts/admin/src/pages/products/detail.tsx",
    "artifacts/admin/src/pages/inventory.tsx",
    "artifacts/admin/src/pages/returns/index.tsx",
    "artifacts/admin/src/pages/returns/detail.tsx",
    "artifacts/admin/src/pages/customers/index.tsx",
    "artifacts/admin/src/pages/customers/detail.tsx",
    "artifacts/admin/src/pages/content.tsx",
    "artifacts/admin/src/pages/discounts.tsx",
    "artifacts/admin/src/pages/shipping.tsx",
    "artifacts/admin/src/pages/support.tsx",
    "artifacts/admin/src/pages/reviews.tsx",
    "artifacts/admin/src/pages/team.tsx",
    "artifacts/admin/src/pages/activity.tsx",
    "artifacts/admin/src/pages/reports.tsx",
    "artifacts/admin/src/pages/system.tsx",
    "artifacts/admin/src/App.tsx",
]

for filepath in files_to_process:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()

    # Fix keepPreviousData
    content = content.replace("keepPreviousData: true", "placeholderData: (prev: any) => prev")

    # Fix App.tsx Route Redirect
    if "App.tsx" in filepath:
        content = content.replace(
            "{() => {\n              const [, setLocation] = useLocation();\n              setLocation('/dashboard');\n              return null;\n            }}",
            "<RedirectToDashboard />"
        )
        if "function App()" in content and "function RedirectToDashboard()" not in content:
            content = content.replace(
                "function App() {",
                "function RedirectToDashboard() {\n  const [, setLocation] = useLocation();\n  setLocation('/dashboard');\n  return null;\n}\n\nfunction App() {"
            )
            
    # Fix mutations
    # useAdminOrderAction({ orderId }) -> useAdminOrderAction()
    content = re.sub(r'useAdminOrderAction\(\{\s*orderId\s*\}\)', 'useAdminOrderAction()', content)
    content = re.sub(r'useAdminUpdateProduct\(\{\s*productId\s*:\s*id\s*\}\)', 'useAdminUpdateProduct()', content)
    content = re.sub(r'useAdminProductAction\(\{\s*productId\s*:\s*id\s*\}\)', 'useAdminProductAction()', content)
    content = re.sub(r'useAdminCreateVariant\(\{\s*productId(:\s*id)?\s*\}\)', 'useAdminCreateVariant()', content)
    content = re.sub(r'useAdminCreateVariant\(createdProduct \? \{\s*productId:\s*createdProduct\.id\s*\} : \{\s*productId:\s*0\s*\}\)', 'useAdminCreateVariant()', content)
    content = re.sub(r'useAdminUpdateVariant\(\{\s*productId,\s*variantId\s*:\s*variant\?\.id\s*\|\|\s*0\s*\}\)', 'useAdminUpdateVariant()', content)
    content = re.sub(r'useAdminAddProductImage\(\{\s*productId\s*\}\)', 'useAdminAddProductImage()', content)
    content = re.sub(r'useAdminDeleteProductImage\(\{\s*productId,\s*imageId\s*:\s*img\.id\s*\}\)', 'useAdminDeleteProductImage()', content)
    content = re.sub(r'useAdminDeleteProductImage\(\{\s*productId,\s*imageId\s*\}\)', 'useAdminDeleteProductImage()', content)
    content = re.sub(r'useAdminReturnAction\(\{\s*returnId\s*\}\)', 'useAdminReturnAction()', content)
    content = re.sub(r'useAdminUpdateContentPage\(\{\s*pageKey\s*:\s*page\.key\s*\}\)', 'useAdminUpdateContentPage()', content)
    content = re.sub(r'useAdminUpdateDiscount\(\{\s*discountId\s*:\s*discount\?\.id\s*\|\|\s*0\s*\}\)', 'useAdminUpdateDiscount()', content)
    content = re.sub(r'useAdminDeleteDiscount\(\{\s*discountId\s*:\s*discount\.id\s*\}\)', 'useAdminDeleteDiscount()', content)
    content = re.sub(r'useAdminUpdateShippingZone\(\{\s*zoneId\s*:\s*zone\?\.id\s*\|\|\s*0\s*\}\)', 'useAdminUpdateShippingZone()', content)
    content = re.sub(r'useAdminDeleteShippingZone\(\{\s*zoneId\s*:\s*zone\.id\s*\}\)', 'useAdminDeleteShippingZone()', content)
    content = re.sub(r'useAdminCreateShippingRate\(\{\s*zoneId\s*\}\)', 'useAdminCreateShippingRate()', content)
    content = re.sub(r'useAdminUpdateShippingRate\(\{\s*zoneId,\s*rateId\s*:\s*rate\?\.id\s*\|\|\s*0\s*\}\)', 'useAdminUpdateShippingRate()', content)
    content = re.sub(r'useAdminDeleteShippingRate\(\{\s*zoneId,\s*rateId\s*:\s*rate\.id\s*\}\)', 'useAdminDeleteShippingRate()', content)
    content = re.sub(r'useAdminUpdateSupportTicket\(\{\s*ticketId\s*:\s*ticket\.id\s*\}\)', 'useAdminUpdateSupportTicket()', content)
    content = re.sub(r'useAdminReviewAction\(\{\s*reviewId\s*\}\)', 'useAdminReviewAction()', content)
    content = re.sub(r'useAdminUpdateUser\(\{\s*clerkUserId\s*:\s*user\.clerkUserId\s*\}\)', 'useAdminUpdateUser()', content)
    content = re.sub(r'useAdminRemoveUser\(\{\s*clerkUserId\s*:\s*user\.clerkUserId\s*\}\)', 'useAdminRemoveUser()', content)

    # Now fix the .mutate({ data }) calls
    content = content.replace("mutate({ data: { action } }", "mutate({ orderId, data: { action } }")
    content = content.replace("mutate({ data: { action: 'fulfill', carrier, trackingNumber, trackingUrl } }", "mutate({ orderId, data: { action: 'fulfill', carrier, trackingNumber, trackingUrl } }")
    
    # Products
    content = content.replace("updateProduct.mutate({\n      data:", "updateProduct.mutate({\n      productId: id,\n      data:")
    content = content.replace("actionProduct.mutate({ data: { action } }", "actionProduct.mutate({ productId: id, data: { action } }")
    content = content.replace("createMut.mutate({ data }", "createMut.mutate({ productId, data }")
    content = content.replace("updateMut.mutate({ data }", "updateMut.mutate({ productId, variantId: variant?.id || 0, data }")
    content = content.replace("mutation.mutate({ data: { url, isPrimary: false } }", "mutation.mutate({ productId, data: { url, isPrimary: false } }")
    content = content.replace("mutation.mutate(undefined,", "mutation.mutate({ productId, imageId },")
    content = content.replace("createVariant.mutate({\n      data:", "createVariant.mutate({\n      productId: createdProduct.id,\n      data:")

    # Returns
    content = content.replace("mutation.mutate({ data: { action, notes } }", "mutation.mutate({ returnId, data: { action, notes } }")
    content = content.replace("mutation.mutate({ \n      data: { \n        action: 'issue_refund',", "mutation.mutate({ \n      returnId,\n      data: { \n        action: 'issue_refund',")

    # Content
    content = content.replace("mutation.mutate({ data: { title, body } }", "mutation.mutate({ pageKey: page.key, data: { title, body } }")

    # Discounts
    content = content.replace("updateMut.mutate({ data }, {", "updateMut.mutate({ discountId: discount?.id || 0, data }, {")
    content = content.replace("mutation.mutate(undefined, {\n      onSuccess: () => {\n        queryClient.invalidateQueries({ queryKey: getAdminListDiscountsQueryKey() });\n        toast({ title: 'Discount Deleted' });", "mutation.mutate({ discountId: discount.id }, {\n      onSuccess: () => {\n        queryClient.invalidateQueries({ queryKey: getAdminListDiscountsQueryKey() });\n        toast({ title: 'Discount Deleted' });")

    # Shipping
    content = content.replace("updateMut.mutate({ data }, {\n        onSuccess: () => {\n          toast({ title: 'Zone Updated' });", "updateMut.mutate({ zoneId: zone?.id || 0, data }, {\n        onSuccess: () => {\n          toast({ title: 'Zone Updated' });")
    content = content.replace("mutation.mutate(undefined, {\n      onSuccess: () => {\n        queryClient.invalidateQueries({ queryKey: getAdminListShippingZonesQueryKey() });\n        toast({ title: 'Zone Deleted' });", "mutation.mutate({ zoneId: zone.id }, {\n      onSuccess: () => {\n        queryClient.invalidateQueries({ queryKey: getAdminListShippingZonesQueryKey() });\n        toast({ title: 'Zone Deleted' });")
    content = content.replace("createMut.mutate({ data }, {\n        onSuccess: () => {\n          toast({ title: 'Rate Created' });", "createMut.mutate({ zoneId, data }, {\n        onSuccess: () => {\n          toast({ title: 'Rate Created' });")
    content = content.replace("updateMut.mutate({ data }, {\n        onSuccess: () => {\n          toast({ title: 'Rate Updated' });", "updateMut.mutate({ zoneId, rateId: rate?.id || 0, data }, {\n        onSuccess: () => {\n          toast({ title: 'Rate Updated' });")
    content = content.replace("mutation.mutate(undefined, {\n      onSuccess: () => {\n        queryClient.invalidateQueries({ queryKey: getAdminListShippingZonesQueryKey() });\n        toast({ title: 'Rate Deleted' });", "mutation.mutate({ zoneId, rateId: rate.id }, {\n      onSuccess: () => {\n        queryClient.invalidateQueries({ queryKey: getAdminListShippingZonesQueryKey() });\n        toast({ title: 'Rate Deleted' });")

    # Support
    content = content.replace("mutation.mutate({ data: { status, priority } }", "mutation.mutate({ ticketId: ticket.id, data: { status, priority } }")

    # Reviews
    content = content.replace("actionMutation.mutate({ data: { action } as any }", "actionMutation.mutate({ reviewId, data: { action } as any }")
    content = content.replace("mutation.mutate({ data: { action: 'approve' as any } }", "mutation.mutate({ reviewId, data: { action: 'approve' as any } }")
    content = content.replace("mutation.mutate({ data: { action: 'reject' as any } }", "mutation.mutate({ reviewId, data: { action: 'reject' as any } }")

    # Team
    content = content.replace("mutation.mutate({ data: { role } }", "mutation.mutate({ clerkUserId: user.clerkUserId, data: { role } }")
    content = content.replace("mutation.mutate(undefined, {\n      onSuccess: () => {\n        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });\n        toast({ title: 'User Removed' });", "mutation.mutate({ clerkUserId: user.clerkUserId }, {\n      onSuccess: () => {\n        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });\n        toast({ title: 'User Removed' });")


    with open(filepath, 'w') as f:
        f.write(content)

print("Fixed mutations!")
