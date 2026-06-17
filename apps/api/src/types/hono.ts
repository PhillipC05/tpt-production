export type AppBindings = {
  Variables: {
    requestId: string;
    user: { id: string; role: "USER" | "ADMIN" };
  };
};
