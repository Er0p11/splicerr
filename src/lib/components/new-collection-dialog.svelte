<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog"
    import Button from "$lib/components/ui/button/button.svelte"
    import Input from "$lib/components/ui/input/input.svelte"
    import Label from "$lib/components/ui/label/label.svelte"
    import {
        addSample,
        createCollection,
        newCollectionDialog,
        setPackInCollection,
    } from "$lib/shared/collections.svelte"
    import { openCollection } from "$lib/shared/view.svelte"
    import { toast } from "$lib/shared/toasts.svelte"

    let name = $state("")

    // Reset the field whenever the dialog opens.
    $effect(() => {
        if (newCollectionDialog.open) name = ""
    })

    const create = () => {
        if (!name.trim()) return
        const collection = createCollection(name)
        const asset = newCollectionDialog.pendingAsset
        if (asset) {
            if ("parents" in asset) addSample(collection.uuid, asset)
            else void setPackInCollection(collection.uuid, asset, true).catch((error) => {
                console.error("Could not save pack", error)
                toast({ title: "Could not save pack", variant: "error" })
            })
        } else {
            // Created from the sidebar: jump into the new collection.
            openCollection(collection.uuid)
        }
        newCollectionDialog.open = false
        newCollectionDialog.pendingAsset = null
        toast({
            title: "Collection created",
            description: collection.name,
            variant: "success",
        })
    }
</script>

<Dialog.Root
    open={newCollectionDialog.open}
    onOpenChange={(open) => {
        newCollectionDialog.open = open
        if (!open) newCollectionDialog.pendingAsset = null
    }}
>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>New collection</Dialog.Title>
        </Dialog.Header>
        <div class="flex flex-col gap-2 py-2">
            <Label for="newCollectionName">Name</Label>
            <!-- svelte-ignore a11y_autofocus -->
            <Input
                id="newCollectionName"
                bind:value={name}
                placeholder="e.g. Drums, FX, My track"
                class="h-9"
                autofocus
                onkeydown={(e) => {
                    if (e.key === "Enter") create()
                }}
            />
        </div>
        <Dialog.Footer>
            <Button
                variant="outline"
                onclick={() => (newCollectionDialog.open = false)}
            >
                Cancel
            </Button>
            <Button onclick={create} disabled={!name.trim()}>Create</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
