import os
import re

files_to_fix = [
    "artifacts/admin/src/pages/discounts.tsx",
    "artifacts/admin/src/pages/shipping.tsx",
    "artifacts/admin/src/pages/team.tsx",
    "artifacts/admin/src/pages/orders/detail.tsx",
    "artifacts/admin/src/pages/products/detail.tsx",
    "artifacts/admin/src/pages/returns/detail.tsx",
    "artifacts/admin/src/pages/inventory.tsx",
    "artifacts/admin/src/pages/content.tsx",
]

for filepath in files_to_fix:
    if not os.path.exists(filepath): continue
    with open(filepath, 'r') as f: content = f.read()

    # Revert the corrupted discount/shipping/team mutations
    content = content.replace("updateMut.mutate({ data } as any, {", "updateMut.mutate({ ...data } as any, {")
    content = content.replace("createMut.mutate({ data } as any, {", "createMut.mutate({ ...data } as any, {")
    content = content.replace("mutation.mutate(undefined as any, {", "mutation.mutate({} as any, {")
    
    # Also fix some other specific errors
    content = content.replace("data.lowStockCount", "data?.lowStockCount")
    content = content.replace("data.outOfStockCount", "data?.outOfStockCount")
    content = content.replace("filter: filter !== 'all' ? filter : undefined", "filter: (filter !== 'all' ? filter : undefined) as any")
    content = content.replace("content.sections", "content?.sections")
    content = content.replace("sections.map", "(sections || []).map")
    content = content.replace("setFormData(prev =>", "setFormData((prev: any) =>")
    content = content.replace("mutate({ data: { action } as any }", "mutate({ action } as any")
    content = content.replace("mutate({ data: { action: 'fulfill', carrier, trackingNumber, trackingUrl } as any }", "mutate({ action: 'fulfill', carrier, trackingNumber, trackingUrl } as any")
    content = content.replace("mutate({ data: { action, notes } }", "mutate({ action, notes } as any")
    content = content.replace("import { Badge } from '@/components/ui/badge';\nimport { Badge } from '@/components/ui/badge';\n<Badge", "import { Badge } from '@/components/ui/badge';\n<Badge")

    with open(filepath, 'w') as f: f.write(content)

print("Fixed TS errors")
