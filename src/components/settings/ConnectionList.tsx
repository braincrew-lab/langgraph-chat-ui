"use client";

import { useState, useEffect } from "react";
import { Trash2, Check, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAllConnections,
  deleteConnection,
  switchConnection,
  addConnection,
  type Connection,
} from "@/lib/connections";
import { toast } from "sonner";

interface ConnectionListProps {
  onConnectionChange?: () => void;
}

export function ConnectionList({ onConnectionChange }: ConnectionListProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [newConnection, setNewConnection] = useState({
    name: "",
    apiUrl: "",
    assistantId: "",
    apiKey: "",
  });

  // Validate LangGraph URL by calling /info endpoint
  const validateLangGraphUrl = async (apiUrl: string, apiKey?: string): Promise<boolean> => {
    try {
      const url = apiUrl.replace(/\/$/, ""); // Remove trailing slash
      const res = await fetch(`${url}/info`, {
        headers: apiKey ? { "X-Api-Key": apiKey } : {},
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    loadConnectionList();
  }, []);

  const loadConnectionList = () => {
    const allConnections = getAllConnections();
    setConnections(allConnections);
  };

  const getNextConnectionName = (): string => {
    const existingConnections = getAllConnections();
    const customCount = existingConnections.filter((c) => !c.isDefault).length;
    return `Connection ${customCount + 1}`;
  };

  const handleAddConnection = async () => {
    if (!newConnection.apiUrl) {
      toast.error("API URL is required");
      return;
    }

    // Validate LangGraph URL
    setIsValidating(true);
    const isValid = await validateLangGraphUrl(
      newConnection.apiUrl,
      newConnection.apiKey || undefined
    );
    setIsValidating(false);

    if (!isValid) {
      toast.error("Invalid LangGraph URL. Please check the URL and try again.");
      return;
    }

    // Auto-generate name if empty
    const connectionName = newConnection.name.trim() || getNextConnectionName();

    addConnection(
      connectionName,
      newConnection.apiUrl,
      newConnection.assistantId || undefined,
      newConnection.apiKey || undefined
    );

    toast.success("Connection added successfully");
    setNewConnection({ name: "", apiUrl: "", assistantId: "", apiKey: "" });
    setIsAdding(false);
    loadConnectionList();
  };

  const handleDeleteConnection = (connectionId: string) => {
    if (confirm("Are you sure you want to delete this connection?")) {
      deleteConnection(connectionId);
      toast.success("Connection deleted");
      loadConnectionList();
    }
  };

  const handleSwitchConnection = (connection: Connection) => {
    if (connection.isActive) return;

    switchConnection(connection.id);

    // Save API key to localStorage if provided
    if (connection.apiKey) {
      localStorage.setItem("lg:chat:apiKey", connection.apiKey);
    }

    toast.success(`Switching to ${connection.name}...`);

    // Reload page to apply connection (cookies are already set by switchConnection)
    setTimeout(() => {
      window.location.href = window.location.pathname;
    }, 500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-muted-foreground">
          Saved Connections ({connections.length})
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Connection
        </Button>
      </div>

      {/* Add Connection Form */}
      {isAdding && (
        <div className="space-y-3 p-4 border rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="conn-name">Connection Name (Optional)</Label>
            <Input
              id="conn-name"
              placeholder="e.g., Local Dev, Production"
              value={newConnection.name}
              onChange={(e) =>
                setNewConnection({ ...newConnection, name: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for auto-generated name (Connection 1, 2, ...)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="conn-url">API URL *</Label>
            <Input
              id="conn-url"
              placeholder="http://localhost:2024"
              value={newConnection.apiUrl}
              onChange={(e) =>
                setNewConnection({ ...newConnection, apiUrl: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="conn-assistant">Assistant ID (Optional)</Label>
            <Input
              id="conn-assistant"
              placeholder="agent"
              value={newConnection.assistantId}
              onChange={(e) =>
                setNewConnection({
                  ...newConnection,
                  assistantId: e.target.value,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to auto-load available graphs
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="conn-key">API Key (Optional)</Label>
            <Input
              id="conn-key"
              type="password"
              placeholder="lsv2_..."
              value={newConnection.apiKey}
              onChange={(e) =>
                setNewConnection({ ...newConnection, apiKey: e.target.value })
              }
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleAddConnection} size="sm" disabled={isValidating}>
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                "Save Connection"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsAdding(false)}
              size="sm"
              disabled={isValidating}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Connection List */}
      <div className="space-y-2">
        {connections.map((connection) => (
          <div
            key={connection.id}
            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors ${
              connection.isActive ? "bg-accent border-primary" : ""
            }`}
            onClick={() => handleSwitchConnection(connection)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{connection.name}</p>
                {connection.isDefault && (
                  <span className="text-xs px-2 py-0.5 bg-muted rounded">
                    Default
                  </span>
                )}
                {connection.isActive && <Check className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {connection.apiUrl}
                {connection.assistantId && ` • ${connection.assistantId}`}
              </p>
            </div>

            {!connection.isDefault && (
              <Button
                variant="ghost"
                size="sm"
                disabled={connection.isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteConnection(connection.id);
                }}
              >
                <Trash2 className={`h-4 w-4 ${connection.isActive ? "text-muted-foreground" : "text-destructive"}`} />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
