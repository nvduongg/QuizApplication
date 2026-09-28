using backend.Constants;
using backend.Models;
using Microsoft.AspNetCore.Identity;

namespace backend.Data
{
    public static class DbSeeder
    {
        public static async Task SeedAsync(
            IServiceProvider serviceProvider,
            IConfiguration configuration)
        {
            var roleManager =
                serviceProvider.GetRequiredService<
                    RoleManager<IdentityRole>>();

            var userManager =
                serviceProvider.GetRequiredService<
                    UserManager<ApplicationUser>>();

            await EnsureRoleAsync(
                roleManager,
                AppRoles.Administrator);

            await EnsureRoleAsync(
                roleManager,
                AppRoles.User);

            var adminEmail =
                configuration["SeedAdmin:Email"];

            var adminPassword =
                configuration["SeedAdmin:Password"];

            var adminFullName =
                configuration["SeedAdmin:FullName"]
                ?? "System Administrator";

            if (string.IsNullOrWhiteSpace(adminEmail) ||
                string.IsNullOrWhiteSpace(adminPassword))
            {
                return;
            }

            var admin =
                await userManager.FindByEmailAsync(
                    adminEmail);

            if (admin == null)
            {
                admin = new ApplicationUser
                {
                    UserName = adminEmail,
                    Email = adminEmail,
                    FullName = adminFullName,
                    EmailConfirmed = true
                };

                var createResult =
                    await userManager.CreateAsync(
                        admin,
                        adminPassword);

                if (!createResult.Succeeded)
                {
                    var errors = string.Join(
                        "; ",
                        createResult.Errors
                            .Select(e => e.Description));

                    throw new InvalidOperationException(
                        $"Unable to seed Administrator: {errors}");
                }
            }

            if (!await userManager.IsInRoleAsync(
                    admin,
                    AppRoles.Administrator))
            {
                var roleResult =
                    await userManager.AddToRoleAsync(
                        admin,
                        AppRoles.Administrator);

                if (!roleResult.Succeeded)
                {
                    var errors = string.Join(
                        "; ",
                        roleResult.Errors
                            .Select(e => e.Description));

                    throw new InvalidOperationException(
                        $"Unable to assign Administrator role: {errors}");
                }
            }
        }

        private static async Task EnsureRoleAsync(
            RoleManager<IdentityRole> roleManager,
            string roleName)
        {
            if (await roleManager.RoleExistsAsync(roleName))
            {
                return;
            }

            var result =
                await roleManager.CreateAsync(
                    new IdentityRole(roleName));

            if (!result.Succeeded)
            {
                var errors = string.Join(
                    "; ",
                    result.Errors
                        .Select(e => e.Description));

                throw new InvalidOperationException(
                    $"Unable to seed role '{roleName}': {errors}");
            }
        }
    }
}