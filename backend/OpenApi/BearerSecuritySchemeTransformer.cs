using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace backend.OpenApi
{
    internal sealed class BearerSecuritySchemeTransformer
        : IOpenApiDocumentTransformer
    {
        private readonly IAuthenticationSchemeProvider
            _authenticationSchemeProvider;

        public BearerSecuritySchemeTransformer(
            IAuthenticationSchemeProvider authenticationSchemeProvider)
        {
            _authenticationSchemeProvider =
                authenticationSchemeProvider;
        }

        public async Task TransformAsync(
            OpenApiDocument document,
            OpenApiDocumentTransformerContext context,
            CancellationToken cancellationToken)
        {
            var authenticationSchemes =
                await _authenticationSchemeProvider
                    .GetAllSchemesAsync();

            var hasBearer =
                authenticationSchemes.Any(
                    scheme => scheme.Name == "Bearer");

            if (!hasBearer)
            {
                return;
            }

            document.Components ??=
                new OpenApiComponents();

            document.Components.SecuritySchemes ??=
                new Dictionary<
                    string,
                    IOpenApiSecurityScheme>();

            document.Components.SecuritySchemes["Bearer"] =
                new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    Description =
                        "Enter JWT Bearer token."
                };

            document.Security ??=
                new List<OpenApiSecurityRequirement>();

            document.Security.Add(
                new OpenApiSecurityRequirement
                {
                    [
                        new OpenApiSecuritySchemeReference(
                            "Bearer",
                            document)
                    ] = []
                });
        }
    }
}