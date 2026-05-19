"use client";

export function SignupForm() {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const data = new FormData(form);
        alert(
          `Thanks! We'll contact you at ${data.get("email")} within 24 hours to set up your DigiVoceEats account.`,
        );
        form.reset();
      }}
    >
      {[
        {
          name: "restaurant",
          label: "Restaurant Name",
          placeholder: "Bread & Kabob",
          type: "text",
        },
        { name: "name", label: "Your Name", placeholder: "John Smith", type: "text" },
        {
          name: "email",
          label: "Email Address",
          placeholder: "owner@restaurant.com",
          type: "email",
        },
        {
          name: "phone",
          label: "Phone Number",
          placeholder: "(703) 555-0100",
          type: "tel",
        },
        {
          name: "address",
          label: "Restaurant Address",
          placeholder: "123 Main St, Falls Church, VA",
          type: "text",
        },
      ].map((field) => (
        <div key={field.name} style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              color: "#9CA3AF",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 8,
            }}
          >
            {field.label}
          </label>
          <input
            name={field.name}
            type={field.type}
            placeholder={field.placeholder}
            required
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "12px 16px",
              color: "#F9FAFB",
              fontSize: 14,
              outline: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>
      ))}
      <button
        type="submit"
        style={{
          width: "100%",
          background: "linear-gradient(135deg,#FF6B35,#FF8C5A)",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "14px",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          marginTop: 8,
        }}
      >
        Request Setup →
      </button>
      <p style={{ color: "#4B5563", fontSize: 12, textAlign: "center", marginTop: 16 }}>
        We&apos;ll contact you within 24 hours to complete setup. No credit card required.
      </p>
    </form>
  );
}
