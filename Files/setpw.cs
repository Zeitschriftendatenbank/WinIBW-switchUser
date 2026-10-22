using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

class SetPw
{
    [StructLayout(LayoutKind.Sequential)]
    private struct DATA_BLOB
    {
        public int cbData;
        public IntPtr pbData;
    }

    [DllImport("crypt32.dll",
        CharSet = CharSet.Unicode,
        SetLastError = true)]
    private static extern bool CryptProtectData(
        ref DATA_BLOB pDataIn,
        string szDataDescr,
        IntPtr pOptionalEntropy,
        IntPtr pvReserved,
        IntPtr pPromptStruct,
        uint dwFlags,
        ref DATA_BLOB pDataOut
    );

    static int Main(string[] args)
    {
        try
        {
            if (args.Length != 2)
            {
                Console.Error.WriteLine(
                    "Usage: setpw.exe <encrypted-file> <password>");
                return 2;
            }

            string file = args[0];
            string password = args[1];

            byte[] plain = Encoding.Unicode.GetBytes(password);

            DATA_BLOB input = new DATA_BLOB();
            DATA_BLOB output = new DATA_BLOB();

            input.cbData = plain.Length;
            input.pbData = Marshal.AllocHGlobal(plain.Length);

            try
            {
                Marshal.Copy(plain, 0, input.pbData, plain.Length);

                if (!CryptProtectData(
                    ref input,
                    null,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    0,
                    ref output))
                {
                    int error = Marshal.GetLastWin32Error();

                    Console.Error.WriteLine(
                        "CryptProtectData failed. Error: " + error);

                    return 3;
                }

                byte[] encrypted = new byte[output.cbData];

                Marshal.Copy(
                    output.pbData,
                    encrypted,
                    0,
                    output.cbData);

                string hex = BytesToHex(encrypted);

                string directory = Path.GetDirectoryName(file);

                if (!String.IsNullOrEmpty(directory) &&
                    !Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                File.WriteAllText(
                    file,
                    hex,
                    Encoding.ASCII);

                return 0;
            }
            finally
            {
                if (input.pbData != IntPtr.Zero)
                    Marshal.FreeHGlobal(input.pbData);

                if (output.pbData != IntPtr.Zero)
                    Marshal.FreeHGlobal(output.pbData);

                // Remove the plaintext byte array as far as possible.
                for (int i = 0; i < plain.Length; i++)
                    plain[i] = 0;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static string BytesToHex(byte[] data)
    {
        StringBuilder sb = new StringBuilder(data.Length * 2);

        for (int i = 0; i < data.Length; i++)
        {
            sb.Append(data[i].ToString("x2"));
        }

        return sb.ToString();
    }
}